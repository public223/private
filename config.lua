ACPanel = {}

ACPanel.RoutePrefix = "/ac"
ACPanel.SessionSecret = "CHANGE_ME_64CHARS_MINIMUM_SECRET"

ACPanel.SetupEnabled = true

-- ✅ إذا بتخليها خلف Nginx فقط، خله true وخلي allowlist فيها 127.0.0.1
ACPanel.IPAllowlistEnabled = false
ACPanel.IPAllowlist = {
  "127.0.0.1",
  "::1",
}

ACPanel.RateLimit = { WindowSec = 10, MaxRequests = 80 }

-- ✅ بورت اللوحة (لازم غير 30120)
ACPanel.PanelPort = 40120

-- ✅ استمع محلي فقط إذا تستخدم Nginx Reverse Proxy
ACPanel.PanelHost = "0.0.0.0"  -- لو بدون nginx خله 0.0.0.0
-- ACPanel.PanelHost = "127.0.0.1" -- لو مع nginx
