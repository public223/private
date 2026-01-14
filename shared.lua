local function dbg(...)
  if AC and AC.Debug then
    print('[PulseAC][DBG]', ...)
  end
end

PulseAC = { dbg = dbg }

function PulseAC.Now()
  return os.time(os.date('!*t'))
end

function PulseAC.IsWhitelisted(identifierList)
  if not identifierList then return false end
  local wl = (AC.Whitelist and AC.Whitelist.Identifiers) or {}
  if #wl == 0 then return false end
  for _, id in ipairs(identifierList) do
    for _, w in ipairs(wl) do
      if id == w then return true end
    end
  end
  return false
end
