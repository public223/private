local QBCore = exports[AC.CoreExport]:GetCoreObject()

local AC_TOKEN = nil

RegisterNetEvent('pulse_ac:client:setToken', function(t)
  AC_TOKEN = t
end)

CreateThread(function()
  while true do
    Wait(5000)
    if not AC.Detections.EventProtection.Enabled then goto continue end
    if not AC_TOKEN then
      TriggerServerEvent('pulse_ac:server:securePing', AC_TOKEN or '')
    end
    ::continue::
  end
end)

local function flag(det, reason, extra)
  TriggerServerEvent('pulse_ac:server:flag', {
    token = AC_TOKEN,
    det = det,
    reason = reason,
    extra = extra
  })
end

-- =========================
-- Weapon blacklist
-- =========================
CreateThread(function()
  while true do
    Wait(1200)
    if not AC.Detections.WeaponBlacklist.Enabled then goto continue end
    local ped = PlayerPedId()
    if not DoesEntityExist(ped) then goto continue end

    local weapon = GetSelectedPedWeapon(ped)
    for _, w in ipairs(AC.Detections.WeaponBlacklist.BlockedWeapons) do
      if weapon == w then
        RemoveWeaponFromPed(ped, weapon)
        flag('WeaponBlacklist', 'Blacklisted weapon detected', { weapon = weapon })
        break
      end
    end
    ::continue::
  end
end)

-- =========================
-- Godmode / Heal spam
-- =========================
local lastHealth = nil
local heals = { t = 0, c = 0 }

CreateThread(function()
  while true do
    Wait(AC.Detections.Godmode.CheckIntervalMs or 2500)
    if not AC.Detections.Godmode.Enabled then goto continue end

    local ped = PlayerPedId()
    if not DoesEntityExist(ped) then goto continue end
    if IsEntityDead(ped) then lastHealth = nil goto continue end

    local health = GetEntityHealth(ped)
    local maxHealth = GetEntityMaxHealth(ped)

    if GetPlayerInvincible(PlayerId()) or GetEntityInvincible(ped) then
      flag('Godmode', 'Invincibility detected', {})
    end

    if lastHealth then
      local delta = health - lastHealth
      if delta > (AC.Detections.Godmode.MaxHealthDelta or 35) and health <= maxHealth then
        local now = GetGameTimer()
        if (now - heals.t) > (AC.Detections.HealSpam.WindowMs or 8000) then
          heals.t = now
          heals.c = 0
        end
        heals.c = heals.c + 1
        if AC.Detections.HealSpam.Enabled and heals.c > (AC.Detections.HealSpam.MaxHealsInWindow or 3) then
          flag('HealSpam', 'Heal spam detected', { heals = heals.c, delta = delta })
        end
      end
    end

    lastHealth = health
    ::continue::
  end
end)

-- =========================
-- SpeedHack
-- =========================
CreateThread(function()
  while true do
    Wait(AC.Detections.SpeedHack.CheckIntervalMs or 1500)
    if not AC.Detections.SpeedHack.Enabled then goto continue end

    local ped = PlayerPedId()
    if not DoesEntityExist(ped) then goto continue end

    if IsPedInAnyVehicle(ped, false) then
      local veh = GetVehiclePedIsIn(ped, false)
      local kmh = GetEntitySpeed(veh) * 3.6
      if kmh > (AC.Detections.SpeedHack.MaxVehSpeed or 140.0) and GetEntityHeightAboveGround(veh) < 5.0 then
        flag('SpeedHack', 'Vehicle speed suspicious', { kmh = kmh })
      end
    else
      local kmh = GetEntitySpeed(ped) * 3.6
      if kmh > ((AC.Detections.SpeedHack.MaxRunSpeed or 9.0) * 3.6) and not IsPedFalling(ped) and not IsPedRagdoll(ped) then
        flag('SpeedHack', 'Run speed suspicious', { kmh = kmh })
      end
    end

    ::continue::
  end
end)

-- =========================
-- SuperJump
-- =========================
local jump = { t = 0, c = 0 }

CreateThread(function()
  while true do
    Wait(250)
    if not AC.Detections.SuperJump.Enabled then goto continue end

    local ped = PlayerPedId()
    if not DoesEntityExist(ped) or IsEntityDead(ped) then goto continue end

    if IsPedJumping(ped) then
      local now = GetGameTimer()
      if (now - jump.t) > (AC.Detections.SuperJump.WindowMs or 6000) then
        jump.t = now
        jump.c = 0
      end
      jump.c = jump.c + 1
      if jump.c > (AC.Detections.SuperJump.MaxJumpCountInWindow or 8) then
        flag('SuperJump', 'Jump spam suspicious', { count = jump.c })
        jump.c = 0
        jump.t = now
      end
    end

    ::continue::
  end
end)

-- =========================
-- Teleport / Noclip indicators
-- =========================
local lastPos = nil
local noclipScore = 0

CreateThread(function()
  while true do
    Wait(AC.Detections.Teleport.TickMs or 1200)
    if (not AC.Detections.Teleport.Enabled and not AC.Detections.Noclip.Enabled) then goto continue end

    local ped = PlayerPedId()
    if not DoesEntityExist(ped) or IsEntityDead(ped) then
      lastPos = nil
      noclipScore = 0
      goto continue
    end

    local inVeh = IsPedInAnyVehicle(ped, false)
    local pos = GetEntityCoords(ped)

    if lastPos then
      local dist = #(pos - lastPos)

      if AC.Detections.Teleport.Enabled then
        if not (AC.Detections.Teleport.IgnoreIfInVehicle and inVeh) then
          if dist > (AC.Detections.Teleport.MaxDistancePerTick or 75.0) and not IsPedFalling(ped) then
            flag('Teleport', 'Teleport distance spike', { dist = dist })
          end
        end
      end

      if AC.Detections.Noclip.Enabled then
        local height = GetEntityHeightAboveGround(ped)
        local vel = GetEntitySpeed(ped)
        local alpha = GetEntityAlpha(ped)
        local falling = IsPedFalling(ped)
        local ragdoll = IsPedRagdoll(ped)

        local suspicious = false
        if height > 12.0 and vel > 6.0 and (not falling) and (not ragdoll) then
          suspicious = true
        end
        if alpha < 200 then
          suspicious = true
        end

        if suspicious then
          noclipScore = noclipScore + 1
        else
          noclipScore = math.max(0, noclipScore - 1)
        end

        if noclipScore >= (AC.Detections.Noclip.SuspicionThreshold or 6) then
          flag('Noclip', 'Noclip indicators detected', { score = noclipScore, height = height, speed = vel })
          noclipScore = 0
        end
      end
    end

    lastPos = pos
    ::continue::
  end
end)

-- =========================
-- Death/Kill to server
-- =========================
AddEventHandler('gameEventTriggered', function(name, args)
  if name ~= 'CEventNetworkEntityDamage' then return end

  local victim = args[1]
  local attacker = args[2]
  local victimPed = PlayerPedId()

  if victim ~= victimPed then return end
  if not IsEntityDead(victimPed) then return end

  local killerServerId = -1
  local attackerPlayer = NetworkGetPlayerIndexFromPed(attacker)
  if attackerPlayer ~= -1 then
    killerServerId = GetPlayerServerId(attackerPlayer)
  end

  TriggerServerEvent('pulse_ac:server:deathLog', killerServerId, AC_TOKEN)
end)
