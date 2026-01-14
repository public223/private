const http = require("http");
const crypto = require("crypto");
const url = require("url");

const ox = global.exports.oxmysql;

const cfg = global.ACPanel || {};
const routePrefix = cfg.RoutePrefix || "/ac";
const secret = cfg.SessionSecret || "CHANGE_ME";
const setupEnabled = cfg.SetupEnabled !== false;

const ipAllowEnabled = !!cfg.IPAllowlistEnabled;
const ipAllow = cfg.IPAllowlist || ["127.0.0.1", "::1"];

const rlWindowSec = (cfg.RateLimit && cfg.RateLimit.WindowSec) || 10;
const rlMax = (cfg.RateLimit && cfg.RateLimit.MaxRequests) || 80;
const RL = new Map();

const PANEL_PORT = cfg.PanelPort || 40120;
const PANEL_HOST = cfg.PanelHost || "0.0.0.0";

function nowSec() { return Math.floor(Date.now() / 1000); }
function sha256(s) { return crypto.createHash("sha256").update(String(s)).digest("hex"); }
function hmac(s) { return crypto.createHmac("sha256", secret).update(String(s)).digest("hex"); }
function randId() { return crypto.randomBytes(24).toString("hex"); }

async function q(sql, params) { return await ox.query_async(sql, params); }
async function single(sql, params) { const rows = await q(sql, params); return rows && rows[0] ? rows[0] : null; }
async function exec(sql, params) { return await ox.update_async(sql, params); }

function send(res, code, body, headers = {}) {
  res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}
function sendJSON(res, code, obj, headers = {}) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(obj));
}
function sendFile(res, code, content, contentType) {
  res.writeHead(code, { "Content-Type": contentType });
  res.end(content);
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || "";
  raw.split(";").forEach(p => {
    const i = p.indexOf("=");
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

// ✅ Real IP for licensing IP bind
function getRealIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return String(cf).trim();
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return String(req.socket.remoteAddress || "").trim();
}
function normalizeIp(ip) {
  ip = String(ip || "").trim();
  if (ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");
  return ip;
}

function allowIp(req, res) {
  if (!ipAllowEnabled) return true;
  const ip = normalizeIp(getRealIp(req));
  if (ipAllow.includes(ip)) return true;
  send(res, 403, "Forbidden (IP not allowed)");
  return false;
}

function rateLimit(req, res) {
  const ip = normalizeIp(getRealIp(req));
  const key = ip + "|" + Math.floor(Date.now() / 1000 / rlWindowSec);
  const v = (RL.get(key) || 0) + 1;
  RL.set(key, v);
  if (v > rlMax) {
    send(res, 429, "Too Many Requests");
    return false;
  }
  return true;
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => d += c);
    req.on("end", () => resolve(d));
  });
}

function setCookie(res, name, value) {
  const cookie = `${name}=${encodeURIComponent(value)}; Path=${routePrefix}/; HttpOnly; SameSite=Lax`;
  res.setHeader("Set-Cookie", cookie);
}
function clearCookie(res, name) {
  const cookie = `${name}=; Path=${routePrefix}/; Max-Age=0; HttpOnly; SameSite=Lax`;
  res.setHeader("Set-Cookie", cookie);
}

async function audit(actor, actorRole, action, target, details, ip) {
  await exec(
    "INSERT INTO pulse_panel_audit (actor, actor_role, action, target, details, ip, created_at) VALUES (?,?,?,?,?,?,?)",
    [String(actor), String(actorRole), String(action), target ? String(target) : null, details ? JSON.stringify(details) : null, ip ? String(ip) : null, nowSec()]
  );
}

async function getSettings(key, fallbackJson) {
  const row = await single("SELECT value FROM pulse_panel_settings WHERE `key`=? LIMIT 1", [key]);
  if (!row) return fallbackJson;
  try { return JSON.parse(row.value); } catch { return fallbackJson; }
}
async function setSettings(key, obj) {
  await exec(
    "INSERT INTO pulse_panel_settings (`key`,`value`,updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value), updated_at=VALUES(updated_at)",
    [key, JSON.stringify(obj), nowSec()]
  );
}

async function getSession(req) {
  const c = parseCookies(req);
  const sid = c["pulse_sid"];
  const sig = c["pulse_sig"];
  if (!sid || !sig) return null;
  if (hmac(sid) !== sig) return null;

  const row = await single("SELECT value FROM pulse_panel_settings WHERE `key`=? LIMIT 1", ["sess:" + sid]);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}
async function setSession(res, sessionObj) {
  const sid = randId();
  await setSettings("sess:" + sid, sessionObj);
  setCookie(res, "pulse_sid", sid);
  setCookie(res, "pulse_sig", hmac(sid));
}
async function destroySession(req, res) {
  const c = parseCookies(req);
  const sid = c["pulse_sid"];
  if (sid) await exec("DELETE FROM pulse_panel_settings WHERE `key`=?", ["sess:" + sid]);
  clearCookie(res, "pulse_sid");
  clearCookie(res, "pulse_sig");
}

const PERMS = {
  owner: ["all"],
  admin: ["all"],
  moderator: ["settings_read","settings_write","audit_read","identities_read","identities_write","test_webhook","licenses_read","licenses_write"],
  viewer: ["settings_read","audit_read","identities_read","licenses_read"]
};
function hasPerm(role, perm) {
  if (!role) return false;
  if (role === "owner" || role === "admin") return true;
  const p = PERMS[role] || [];
  return p.includes("all") || p.includes(perm);
}
async function ensureOwnerExists() {
  const row = await single("SELECT id FROM pulse_panel_users WHERE role='owner' LIMIT 1", []);
  return !!row;
}

function emitToLuaWebhooks(webhooks) { emit("pulse_ac:panel:applyWebhooks", webhooks); }
function emitToLuaModules(modules) { emit("pulse_ac:panel:settingsUpdated", { modules }); }

// ✅ Auto Migrate (NO SQL import)
async function migratePanel() {
  await exec(`
    CREATE TABLE IF NOT EXISTS pulse_panel_users (
      id INT NOT NULL AUTO_INCREMENT,
      username VARCHAR(32) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('owner','admin','moderator','viewer') NOT NULL DEFAULT 'viewer',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at INT NOT NULL,
      PRIMARY KEY (id)
    );
  `, []);

  await exec(`
    CREATE TABLE IF NOT EXISTS pulse_panel_settings (
      \`key\` VARCHAR(64) NOT NULL,
      \`value\` LONGTEXT NOT NULL,
      updated_at INT NOT NULL,
      PRIMARY KEY (\`key\`)
    );
  `, []);

  await exec(`
    CREATE TABLE IF NOT EXISTS pulse_panel_audit (
      id INT NOT NULL AUTO_INCREMENT,
      actor VARCHAR(64) NOT NULL,
      actor_role VARCHAR(16) NOT NULL,
      action VARCHAR(32) NOT NULL,
      target VARCHAR(128) NULL,
      details LONGTEXT NULL,
      ip VARCHAR(64) NULL,
      created_at INT NOT NULL,
      PRIMARY KEY (id),
      INDEX(created_at),
      INDEX(action)
    );
  `, []);

  await exec(`
    CREATE TABLE IF NOT EXISTS pulse_panel_identities (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      identifier VARCHAR(128) NOT NULL,
      created_at INT NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_identifier (identifier),
      INDEX idx_user (user_id)
    );
  `, []);

  
  await exec(`
    CREATE TABLE IF NOT EXISTS pulse_shop_licenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      license_key VARCHAR(64) NOT NULL UNIQUE,
      customer_username VARCHAR(64) NOT NULL,
      plan VARCHAR(32) NOT NULL DEFAULT 'basic',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at INT NOT NULL,
      expires_at INT NOT NULL DEFAULT 0
    );
  `, []);

  await exec(`
    CREATE TABLE IF NOT EXISTS pulse_shop_servers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      license_id INT NOT NULL,
      server_name VARCHAR(64) NOT NULL,
      bind_ip VARCHAR(64) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at INT NOT NULL,
      last_seen INT NOT NULL DEFAULT 0,
      INDEX idx_license_id (license_id),
      INDEX idx_bind_ip (bind_ip)
    );
  `, []);

  // Defaults
  await exec(`
    INSERT IGNORE INTO pulse_panel_settings (\`key\`, \`value\`, updated_at)
    VALUES
    ('webhooks', '{"ac":"","joinleave":"","chat":"","deaths":"","server":""}', UNIX_TIMESTAMP()),
    ('modules', '{"Godmode":true,"HealSpam":true,"SpeedHack":true,"SuperJump":true,"Teleport":true,"Noclip":true,"DamageModifier":true,"WeaponBlacklist":true,"Explosions":true,"EntitySpam":true,"ModelBlacklist":true,"AimAnomaly":true,"HealthArmorIntegrity":true,"EventBlacklist":true}', UNIX_TIMESTAMP());
  `, []);

  console.log("[pulse-ac-panel] migration OK.");
}

function uiIndexHTML() { return LoadResourceFile(GetCurrentResourceName(), "ui/index.html"); }
function uiAppJS() { return LoadResourceFile(GetCurrentResourceName(), "ui/app.js"); }
function uiStyleCSS() { return LoadResourceFile(GetCurrentResourceName(), "ui/style.css"); }

(async () => {
  await migratePanel();

  http.createServer(async (req, res) => {
    try {
      if (!allowIp(req, res)) return;
      if (!rateLimit(req, res)) return;

      const u = url.parse(req.url, true);
      const pathname = u.pathname || "/";
      const ip = normalizeIp(getRealIp(req));
      const now = nowSec();

      if (!pathname.startsWith(routePrefix)) {
        send(res, 404, "Not found");
        return;
      }

      // Static
      if (pathname === `${routePrefix}/` || pathname === `${routePrefix}`) {
        sendFile(res, 200, uiIndexHTML(), "text/html; charset=utf-8"); return;
      }
      if (pathname === `${routePrefix}/app.js`) {
        sendFile(res, 200, uiAppJS(), "application/javascript; charset=utf-8"); return;
      }
      if (pathname === `${routePrefix}/style.css`) {
        sendFile(res, 200, uiStyleCSS(), "text/css; charset=utf-8"); return;
      }

      // Session
      const session = await getSession(req);
      const role = session?.role || null;
      const username = session?.username || null;

      function guard(perm) {
        if (!session) { sendJSON(res, 401, { ok:false, error:"not_logged_in" }); return false; }
        if (!hasPerm(role, perm)) { sendJSON(res, 403, { ok:false, error:"forbidden" }); return false; }
        return true;
      }

      // ✅ License Verify (IP bind) - used by pulse-anticheat
      if (pathname === `${routePrefix}/api/license/verify`) {
        const body = await readBody(req);
        const data = JSON.parse(body || "{}");

        const licenseKey = String(data.licenseKey || "").trim();
        const serverName = String(data.serverName || "server").trim();

        if (!licenseKey) return sendJSON(res, 400, { ok:false, error:"licenseKey_required" });

        const lic = await single("SELECT * FROM pulse_shop_licenses WHERE license_key=? LIMIT 1", [licenseKey]);
        if (!lic || !lic.is_active) return sendJSON(res, 403, { ok:false, error:"license_invalid" });
        if (Number(lic.expires_at) !== 0 && now > Number(lic.expires_at)) return sendJSON(res, 403, { ok:false, error:"license_expired" });

        const srv = await single(
          "SELECT * FROM pulse_shop_servers WHERE license_id=? AND bind_ip=? AND is_active=1 LIMIT 1",
          [lic.id, ip]
        );
        if (!srv) return sendJSON(res, 403, { ok:false, error:"ip_not_bound", ip });

        await exec("UPDATE pulse_shop_servers SET server_name=?, last_seen=? WHERE id=?", [serverName, now, srv.id]);

        const webhooks = await getSettings("webhooks", { ac:"",joinleave:"",chat:"",deaths:"",server:"" });
        const modules  = await getSettings("modules", {});

        const token = hmac(`${licenseKey}|${ip}|${now}`);

        return sendJSON(res, 200, { ok:true, token, ip, plan: lic.plan, modules, webhooks });
      }

      // Setup Owner
      if (pathname === `${routePrefix}/api/setup`) {
        if (!setupEnabled) return sendJSON(res, 403, { ok:false, error:"setup_disabled" });
        const exists = await ensureOwnerExists();
        if (exists) return sendJSON(res, 409, { ok:false, error:"owner_exists" });

        const body = await readBody(req);
        const data = JSON.parse(body || "{}");
        const u1 = String(data.username || "").trim();
        const p1 = String(data.password || "").trim();
        if (!u1 || !p1) return sendJSON(res, 400, { ok:false, error:"username+password required" });

        await exec(
          "INSERT INTO pulse_panel_users (username,password_hash,role,is_active,created_at) VALUES (?,?,?,?,?)",
          [u1, sha256(p1), "owner", 1, nowSec()]
        );

        await audit(u1, "owner", "setup_owner", null, {}, ip);
        return sendJSON(res, 200, { ok:true });
      }

      // Login
      if (pathname === `${routePrefix}/api/login`) {
        const body = await readBody(req);
        const data = JSON.parse(body || "{}");
        const u1 = String(data.username || "").trim();
        const p1 = String(data.password || "").trim();

        const row = await single("SELECT username, role, is_active, password_hash FROM pulse_panel_users WHERE username=? LIMIT 1", [u1]);
        if (!row || !row.is_active) return sendJSON(res, 401, { ok:false, error:"invalid" });
        if (row.password_hash !== sha256(p1)) return sendJSON(res, 401, { ok:false, error:"invalid" });

        await setSession(res, { username: row.username, role: row.role, created_at: nowSec() });
        await audit(u1, row.role, "login", null, {}, ip);
        return sendJSON(res, 200, { ok:true, username: row.username, role: row.role });
      }

      if (pathname === `${routePrefix}/api/logout`) {
        await destroySession(req, res);
        return sendJSON(res, 200, { ok:true });
      }

      if (pathname === `${routePrefix}/api/me`) {
        if (!session) return sendJSON(res, 200, { ok:true, logged:false });
        return sendJSON(res, 200, { ok:true, logged:true, username, role });
      }

      // Settings get
      if (pathname === `${routePrefix}/api/settings/get`) {
        if (!guard("settings_read")) return;
        const webhooks = await getSettings("webhooks", { ac:"",joinleave:"",chat:"",deaths:"",server:"" });
        const modules = await getSettings("modules", {});
        return sendJSON(res, 200, { ok:true, webhooks, modules });
      }

      // Settings set
      if (pathname === `${routePrefix}/api/settings/setWebhooks`) {
        if (!guard("settings_write")) return;
        const body = await readBody(req);
        const data = JSON.parse(body || "{}");
        const webhooks = data.webhooks || {};
        await setSettings("webhooks", webhooks);
        emitToLuaWebhooks(webhooks);
        await audit(username, role, "set_webhooks", null, webhooks, ip);
        return sendJSON(res, 200, { ok:true });
      }

      if (pathname === `${routePrefix}/api/settings/setModules`) {
        if (!guard("settings_write")) return;
        const body = await readBody(req);
        const data = JSON.parse(body || "{}");
        const modules = data.modules || {};
        await setSettings("modules", modules);
        emitToLuaModules(modules);
        await audit(username, role, "set_modules", null, modules, ip);
        return sendJSON(res, 200, { ok:true });
      }

      // Test webhook
      if (pathname === `${routePrefix}/api/testWebhook`) {
        if (!guard("test_webhook")) return;
        const kind = String(u.query.kind || "server");
        emit("pulse_ac:server:internalTestWebhook", kind, 0);
        await audit(username, role, "test_webhook", kind, {}, ip);
        return sendJSON(res, 200, { ok:true });
      }

      // Audit
      if (pathname === `${routePrefix}/api/audit`) {
        if (!guard("audit_read")) return;
        const rows = await q("SELECT * FROM pulse_panel_audit ORDER BY id DESC LIMIT 200", []);
        return sendJSON(res, 200, { ok:true, rows });
      }

      // ✅ Licenses UI APIs (بيع)
      if (pathname === `${routePrefix}/api/licenses/list`) {
        if (!guard("licenses_read")) return;
        const rows = await q("SELECT * FROM pulse_shop_licenses ORDER BY id DESC LIMIT 200", []);
        return sendJSON(res, 200, { ok:true, rows });
      }

      if (pathname === `${routePrefix}/api/licenses/create`) {
        if (!guard("licenses_write")) return;
        const body = await readBody(req);
        const data = JSON.parse(body || "{}");

        const customer = String(data.customer_username||"").trim();
        const plan = String(data.plan||"basic").trim();
        const days = Number(data.days||30);

        if (!customer) return sendJSON(res, 400, { ok:false, error:"customer_username required" });

        const key = "PULSE-" + crypto.randomBytes(12).toString("hex").toUpperCase();
        const expires = days <= 0 ? 0 : (now + days * 86400);

        await exec(
          "INSERT INTO pulse_shop_licenses (license_key, customer_username, plan, is_active, created_at, expires_at) VALUES (?,?,?,?,?,?)",
          [key, customer, plan, 1, now, expires]
        );

        await audit(username, role, "license_create", key, { customer, plan, days }, ip);
        return sendJSON(res, 200, { ok:true, license_key:key, expires_at:expires });
      }

      if (pathname === `${routePrefix}/api/servers/list`) {
        if (!guard("licenses_read")) return;
        const rows = await q(`
          SELECT s.*, l.license_key, l.customer_username, l.plan
          FROM pulse_shop_servers s
          JOIN pulse_shop_licenses l ON l.id = s.license_id
          ORDER BY s.id DESC
          LIMIT 200
        `, []);
        return sendJSON(res, 200, { ok:true, rows });
      }

      if (pathname === `${routePrefix}/api/servers/bind`) {
        if (!guard("licenses_write")) return;
        const body = await readBody(req);
        const data = JSON.parse(body || "{}");

        const licenseKey = String(data.license_key||"").trim();
        const bindIp = normalizeIp(String(data.bind_ip||"").trim());
        const serverName = String(data.server_name||"server").trim();

        if (!licenseKey || !bindIp) return sendJSON(res, 400, { ok:false, error:"license_key + bind_ip required" });

        const lic = await single("SELECT * FROM pulse_shop_licenses WHERE license_key=? LIMIT 1", [licenseKey]);
        if (!lic) return sendJSON(res, 404, { ok:false, error:"license_not_found" });

        await exec(
          "INSERT INTO pulse_shop_servers (license_id, server_name, bind_ip, is_active, created_at, last_seen) VALUES (?,?,?,?,?,?)",
          [lic.id, serverName, bindIp, 1, now, 0]
        );

        await audit(username, role, "server_bind", bindIp, { license_key:licenseKey, server_name:serverName }, ip);
        return sendJSON(res, 200, { ok:true });
      }

      // fallback
      return sendJSON(res, 404, { ok:false, error:"not_found" });

    } catch (e) {
      console.error("[pulse-ac-panel] error:", e);
      try { sendJSON(res, 500, { ok:false, error:"server_error" }); } catch {}
    }
  }).listen(PANEL_PORT, PANEL_HOST, () => {
    console.log(`[pulse-ac-panel] listening on http://${PANEL_HOST}:${PANEL_PORT}${routePrefix}`);
  });

})();
