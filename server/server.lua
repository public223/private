local QBCore = exports[AC.CoreExport]:GetCoreObject()

-- =========================
-- Utilities / Identifiers
-- =========================
local BAN_CACHE = {}
local DET_WINDOW = {}
local EVENT_TOKENS = {}
local EVENT_RL = {}

local function getIdentifiers(src)
  local ids = {}
  for i = 0, GetNumPlayerIdentifiers(src) - 1 do
    ids[#ids+1] = GetPlayerIdentifier(src, i)
  end
  return ids
end

local function getPrimaryIdentifier(src)
  local ids = getIdentifiers(src)
  if AC.Ban.UseLicenseAsPrimary then
    for _, id in ipairs(ids) do
      if id:find('license:') == 1 then
        return id, ids
      end
    end
  end
  return ids[1], ids
end

local function isBanActive(banData)
  if not banData then return false end
  if banData.expires_at == 0 then return true end
  return PulseAC.Now() < banData.expires_at
end

-- =========================
-- Discord Logger (kind based)
-- =========================
local _lastDiscord = {}

local function pickWebhook(kind)
  if not AC.Discord or not AC.Discord.Webhooks then return nil end
  return AC.Discord.Webhooks[kind] or AC.Discord.Webhooks.server
end

local function discordLog(kind, title, description, color)
  if not AC.Discord.Enabled then return end
  local hook = pickWebhook(kind)
  if not hook or hook == '' then return end

  local now = GetGameTimer()
  local last = _lastDiscord[kind] or 0
  local rl = (AC.Discord.RateLimitMs or 1200)
  if (now - last) < rl then return end
  _lastDiscord[kind] = now

  local payload = {
    username = AC.Discord.BotName,
    avatar_url = (AC.Discord.Avatar ~= '' and AC.Discord.Avatar) or nil,
    embeds = {{
      title = title,
      description = description,
      color = color or 16711680,
      footer = { text = AC.ServerName or 'Server' },
      timestamp = os.date('!%Y-%m-%dT%H:%M:%SZ')
    }}
  }

  PerformHttpRequest(hook, function() end, 'POST', json.encode(payload), { ['Content-Type'] = 'application/json' })
end

-- =========================
-- DB helpers
-- =========================
local function dbFetchBan(primary, cb)
  MySQL.single('SELECT * FROM pulse_ac_bans WHERE identifier = ? ORDER BY id DESC LIMIT 1', { primary }, function(row)
    cb(row)
  end)
end

local function dbInsertBan(banData, cb)
  MySQL.insert([[
    INSERT INTO pulse_ac_bans (identifier, identifiers, name, reason, by_who, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  ]],
  {
    banData.identifier,
    banData.identifiers,
    banData.name,
    banData.reason,
    banData.by_who,
    banData.created_at,
    banData.expires_at
  }, function(id)
    if cb then cb(id) end
  end)
end

local function dbInsertLog(logData)
  MySQL.insert([[
    INSERT INTO pulse_ac_logs (identifier, name, action, reason, created_at, extra)
    VALUES (?, ?, ?, ?, ?, ?)
  ]],
  { logData.identifier, logData.name, logData.action, logData.reason, logData.created_at, logData.extra })
end

local function writeLog(action, src, reason, extra, kindOverride)
  local primary = nil
  local ids = nil
  if src and src > 0 then
    primary, ids = getPrimaryIdentifier(src)
  end
  local name = (src and src > 0 and GetPlayerName(src)) or 'SYSTEM'

  local logData = {
    identifier = primary,
    name = name,
    action = action,
    reason = reason,
    created_at = PulseAC.Now(),
    extra = extra and json.encode(extra) or nil
  }

  dbInsertLog(logData)

  local kind = kindOverride or 'server'
  local desc = ('**Name:** %s\n**ID:** %s\n**Identifier:** `%s`\n**Reason:** %s\n**Extra:** `%s`')
      :format(name, tostring(src or 0), primary or 'n/a', reason or 'n/a', extra and json.encode(extra) or 'none')

  discordLog(kind, ('%s | %s'):format(action:upper(), name), desc, action == 'ban' and 15158332 or 16753920)
end

-- =========================
-- Punish
-- =========================
local function punish(src, detection, reason, extra)
  if not src or src <= 0 then return end
  local primary, ids = getPrimaryIdentifier(src)
  if not primary then return end

  if PulseAC.IsWhitelisted(ids) then
    PulseAC.dbg('Whitelisted ignore:', detection, src)
    return
  end

  local policy = AC.Actions[detection] or { Type = 'kick' }
  local pType = policy.Type or 'kick'

  if pType == 'warn' then
    writeLog('warn', src, reason, extra, 'ac')
    TriggerClientEvent('QBCore:Notify', src, ('[AC] %s'):format(reason), 'error')
    return
  end

  if pType == 'kick' then
    writeLog('kick', src, reason, extra, 'ac')
    DropPlayer(src, ('[PulseAC] %s'):format(reason))
    return
  end

  if pType == 'ban' and AC.Ban.Enabled then
    local now = PulseAC.Now()
    local duration = tonumber(policy.DurationMinutes or AC.Ban.DefaultDurationMinutes or 0) or 0
    local expires = duration <= 0 and 0 or (now + duration * 60)

    local banData = {
      identifier = primary,
      identifiers = json.encode(ids),
      name = GetPlayerName(src) or 'unknown',
      reason = ('%s (%s)'):format(reason, detection),
      by_who = 'PulseAC',
      created_at = now,
      expires_at = expires
    }

    BAN_CACHE[primary] = banData

    dbInsertBan(banData, function()
      writeLog('ban', src, banData.reason, extra, 'ac')
      DropPlayer(src, ('[PulseAC] You are banned. Reason: %s'):format(banData.reason))
    end)
    return
  end

  if AC.Ban.KickOnDetectionIfBanDisabled then
    writeLog('kick', src, reason, extra, 'ac')
    DropPlayer(src, ('[PulseAC] %s'):format(reason))
  else
    writeLog('warn', src, reason, extra, 'ac')
  end
end

-- =========================
-- Ban check on connect
-- =========================
AddEventHandler('playerConnecting', function(name, setKickReason, deferrals)
  local src = source
  deferrals.defer()
  Wait(0)

  local primary, ids = getPrimaryIdentifier(src)
  if not primary then
    deferrals.done()
    return
  end

  if PulseAC.IsWhitelisted(ids) then
    deferrals.done()
    return
  end

  local cached = BAN_CACHE[primary]
  if cached and isBanActive(cached) then
    local msg = ('[PulseAC] You are banned.\nReason: %s\n'):format(cached.reason or 'unknown')
    if cached.expires_at and cached.expires_at ~= 0 then
      msg = msg .. ('Expires: %s UTC'):format(os.date('!%Y-%m-%d %H:%M:%S', cached.expires_at))
    else
      msg = msg .. 'Expires: NEVER'
    end
    deferrals.done(msg)
    return
  end

  dbFetchBan(primary, function(row)
    if row and isBanActive(row) then
      BAN_CACHE[primary] = row
      local msg = ('[PulseAC] You are banned.\nReason: %s\n'):format(row.reason or 'unknown')
      if row.expires_at and row.expires_at ~= 0 then
        msg = msg .. ('Expires: %s UTC'):format(os.date('!%Y-%m-%d %H:%M:%S', row.expires_at))
      else
        msg = msg .. 'Expires: NEVER'
      end
      deferrals.done(msg)
    else
      deferrals.done()
    end
  end)
end)

-- =========================
-- FiveM Logs (Join/Leave/Chat)
-- =========================
AddEventHandler('playerJoining', function()
  local src = source
  local name = GetPlayerName(src) or 'unknown'
  local primary = (getPrimaryIdentifier(src)) or 'n/a'
  discordLog('joinleave', '🟢 Player Joined',
    ('**Name:** %s\n**ID:** %s\n**Identifier:** `%s`'):format(name, src, primary),
    5763719
  )
end)

AddEventHandler('playerDropped', function(reason)
  local src = source
  local name = GetPlayerName(src) or 'unknown'
  local primary = (getPrimaryIdentifier(src)) or 'n/a'
  discordLog('joinleave', '🔴 Player Left',
    ('**Name:** %s\n**ID:** %s\n**Identifier:** `%s`\n**Reason:** %s'):format(name, src, primary, reason or 'n/a'),
    15548997
  )
end)

AddEventHandler('chatMessage', function(src, name, msg)
  if not msg or msg == '' then return end
  discordLog('chat', '💬 Chat', ('**%s** [%s]: %s'):format(name or 'unknown', src, msg), 9807270)
end)

-- =========================
-- Death Logs from client
-- =========================
RegisterNetEvent('pulse_ac:server:deathLog', function(killerId, token)
  local src = source
  if AC.Detections.EventProtection.Enabled then
    if not EVENT_TOKENS[src] or token ~= EVENT_TOKENS[src] then return end
  end

  local victimName = GetPlayerName(src) or 'unknown'
  local killerName = (killerId and killerId ~= -1) and (GetPlayerName(killerId) or 'unknown') or 'unknown'

  local txt = ('**Victim:** %s [%s]\n**Killer:** %s [%s]'):format(victimName, src, killerName, killerId or -1)
  discordLog('deaths', '☠️ Death Log', txt, 15105570)
end)

-- =========================
-- Event Protection (token + rate limit)
-- =========================
local function getRule(eventName)
  local rules = AC.Detections.EventProtection.Rules or {}
  return rules[eventName] or { max = AC.Detections.EventProtection.DefaultMaxPerWindow, windowMs = AC.Detections.EventProtection.DefaultWindowMs }
end

local function bumpEvent(src, eventName)
  local now = GetGameTimer()
  EVENT_RL[src] = EVENT_RL[src] or {}
  local r = EVENT_RL[src][eventName]
  if not r then
    r = { t = now, c = 0 }
    EVENT_RL[src][eventName] = r
  end

  local rule = getRule(eventName)
  if (now - r.t) > (rule.windowMs or 4000) then
    r.t = now
    r.c = 0
  end
  r.c = r.c + 1
  return r.c > (rule.max or 12), r.c
end

local function ensureToken(src)
  if not AC.Detections.EventProtection.Enabled then return nil end
  if not EVENT_TOKENS[src] then
    EVENT_TOKENS[src] = ('%d-%d-%d'):format(math.random(100000,999999), src, PulseAC.Now())
  end
  return EVENT_TOKENS[src]
end

RegisterNetEvent('pulse_ac:server:securePing', function(token)
  local src = source
  if not AC.Detections.EventProtection.Enabled then return end
  ensureToken(src)
  if token ~= EVENT_TOKENS[src] then return end
  TriggerClientEvent('pulse_ac:client:setToken', src, EVENT_TOKENS[src])
end)

CreateThread(function()
  while true do
    Wait(AC.Detections.EventProtection.TokenRefreshMs or 60000)
    if not AC.Detections.EventProtection.Enabled then goto continue end
    for _, id in ipairs(GetPlayers()) do
      local src = tonumber(id)
      if src then
        EVENT_TOKENS[src] = ('%d-%d-%d'):format(math.random(100000,999999), src, PulseAC.Now())
        TriggerClientEvent('pulse_ac:client:setToken', src, EVENT_TOKENS[src])
      end
    end
    ::continue::
  end
end)

AddEventHandler('playerDropped', function()
  local src = source
  EVENT_TOKENS[src] = nil
  EVENT_RL[src] = nil
end)

-- =========================
-- Panel Sync: apply webhooks + modules
-- =========================
RegisterNetEvent('pulse_ac:panel:applyWebhooks', function(webhooks)
  if type(webhooks) ~= 'table' then return end
  AC.Discord.Webhooks = AC.Discord.Webhooks or {}
  for k, v in pairs(webhooks) do
    if type(v) == 'string' then AC.Discord.Webhooks[k] = v end
  end
  writeLog('info', 0, 'Webhooks updated from panel', { keys = webhooks }, 'server')
end)

RegisterNetEvent('pulse_ac:panel:settingsUpdated', function(settings)
  if type(settings) ~= 'table' or type(settings.modules) ~= 'table' then return end
  for k, enabled in pairs(settings.modules) do
    if AC.Detections[k] then
      AC.Detections[k].Enabled = (enabled == true)
    end
  end
  writeLog('info', 0, 'Modules updated from panel', settings.modules, 'server')
end)

-- =========================
-- Client flag (detections)
-- =========================
RegisterNetEvent('pulse_ac:server:flag', function(payload)
  local src = source

  -- Rate limit + token check
  if AC.Detections.EventProtection.Enabled then
    ensureToken(src)
    local bad, count = bumpEvent(src, "pulse_ac:server:flag")
    if bad then
      punish(src, 'EntitySpam', 'Event spam detected', { event = 'flag', count = count })
      return
    end
    if type(payload) ~= 'table' or payload.token ~= EVENT_TOKENS[src] then
      return
    end
  end

  if type(payload) ~= 'table' then return end
  local det = payload.det or 'unknown'
  local reason = payload.reason or 'Detection'
  punish(src, det, reason, payload.extra)
end)

-- =========================
-- AntiCrash / AntiSpam
-- =========================
local function windowKey(src, key) return tostring(src) .. ':' .. key end

local function bumpWindow(src, key, windowMs, maxCount)
  local now = GetGameTimer()
  local k = windowKey(src, key)
  DET_WINDOW[k] = DET_WINDOW[k] or { t = now, c = 0 }
  local w = DET_WINDOW[k]

  if (now - w.t) > windowMs then
    w.t = now
    w.c = 0
  end

  w.c = w.c + 1
  if w.c > maxCount then
    return true, w.c
  end
  return false, w.c
end

AddEventHandler('explosionEvent', function(sender, ev)
  if not AC.Detections.Explosions.Enabled then return end
  if sender == 0 then return end
  local hit, count = bumpWindow(sender, 'expl', AC.Detections.Explosions.WindowMs, AC.Detections.Explosions.MaxExplosionsInWindow)
  if hit then
    CancelEvent()
    punish(sender, 'Explosions', 'Explosion spam detected', { count = count, ev = ev })
  end
end)

AddEventHandler('entityCreating', function(entity)
  if not AC.Detections.EntitySpam.Enabled then return end
  local owner = NetworkGetEntityOwner(entity)
  if not owner or owner == 0 then return end
  local hit, count = bumpWindow(owner, 'ents', AC.Detections.EntitySpam.WindowMs, AC.Detections.EntitySpam.MaxEntitiesInWindow)
  if hit then
    CancelEvent()
    punish(owner, 'EntitySpam', 'Entity spam detected', { count = count })
  end
end)

-- =========================
-- Console command: unban
-- =========================
RegisterCommand('ac_unban', function(src, args)
  if src ~= 0 then return end
  local identifier = args[1]
  if not identifier then
    print('[PulseAC] Usage: ac_unban license:xxx')
    return
  end
  BAN_CACHE[identifier] = nil
  MySQL.query('DELETE FROM pulse_ac_bans WHERE identifier = ?', { identifier }, function()
    print('[PulseAC] Unbanned:', identifier)
    discordLog('server', '✅ Unban', ('**Identifier:** `%s`\n**By:** Console'):format(identifier), 5763719)
  end)
end, true)
