# Test completo de "Reiniciar agenda"
$BASE = "http://localhost:3000"
$script:passed = 0
$script:failed = 0
$T = $env:TEMP

function Assert($cond, $msg) {
  if ($cond) { $script:passed++; Write-Host "  PASS  $msg" -ForegroundColor Green }
  else       { $script:failed++; Write-Host "  FAIL  $msg" -ForegroundColor Red }
}

function C-Post($url, $obj, $ck) {
  $j = $obj | ConvertTo-Json -Compress -Depth 6
  $f = "$T\_$([guid]::NewGuid().ToString('N').Substring(0,8)).json"
  [System.IO.File]::WriteAllText($f, $j, [System.Text.UTF8Encoding]::new($false))
  $a = @("-s","-X","POST",$url,"-H","Content-Type: application/json")
  if ($ck) { $a += @("-H","Cookie: $ck") }
  $a += @("--data-binary","@$f")
  $r = & curl.exe @a
  Remove-Item $f -ErrorAction SilentlyContinue
  return ($r | ConvertFrom-Json)
}

function C-Get($url, $ck) {
  $a = @("-s",$url)
  if ($ck) { $a += @("-H","Cookie: $ck") }
  return (& curl.exe @a | ConvertFrom-Json)
}

Write-Host "`n=== TEST: REINICIAR AGENDA ===" -ForegroundColor Cyan

# ── Login ──
$lr = curl.exe -s -i -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{\"email\":\"admin@barberstudio.com\",\"password\":\"admin123\"}'
$sl = ($lr | Select-String "^set-cookie:").Line
$script:auth = ""
if ($sl -match "bs_session=([^;]+)") { $script:auth = "bs_session=$($Matches[1])" }
Assert ($script:auth.Length -gt 10) "Login admin OK"

# ── Verificar auth ──
$me = C-Get "$BASE/api/auth/me" $script:auth
Assert ($me.data.name -eq "Administrador" -and $me.data.role -eq "ADMIN") "Admin activo (/me)"

# ── Datos ──
$svcs = C-Get "$BASE/api/services"
$corte = $svcs.data | Where-Object { $_.name -eq "Corte" } | Select-Object -First 1
Assert ($corte) "Servicio Corte encontrado"

# Fecha =明天 con ≥3 barberos (evitar lunes: solo 2 barberos)
$date = $null
for ($i = 1; $i -le 14; $i++) {
  $d = (Get-Date).Date.AddDays($i)
  $wd = ($d.DayOfWeek.value__ + 6) % 7  # 0=Lun
  if ($wd -ne 0 -and $d.DayOfWeek -ne [DayOfWeek]::Sunday) { # mart-sab
    # Verificar ≥3 barberos activos en ese día
    $bCount = (C-Get "$BASE/api/barbers").data.Count
    if ($bCount -ge 3) { $date = $d.ToString("yyyy-MM-dd"); break }
  }
}
Write-Host "  fecha: $date"

# ── Slots dinámicos ──
$av = C-Get "$BASE/api/availability?serviceId=$($corte.id)&date=$date&barberId=any"
$freeSlots = $av.data.slots | Where-Object { $_.barberIds.Count -ge 1 }
Assert ($freeSlots.Count -ge 5) "Hay $($freeSlots.Count) slots libres"

# ── Crear 5 turnos en slots ESPACIADOS (no consecutivos) ──
# Los slots se toman con salto para que nunca 2 turnos se superpongan
# en el mismo barbero (corte=30min, salto=120min = seguro).
$step = [Math]::Max(1, [Math]::Floor($freeSlots.Count / 6))
$created = @()
for ($i = 0; $i -lt 5; $i++) {
  $slot = $freeSlots[$i * $step]
  $r = C-Post "$BASE/api/appointments" @{
    serviceId = $corte.id
    barberId = "any"
    date = $date
    startMin = $slot.minute
    customerName = "ResetTest$i"
    customerPhone = "549110000$i"
  }
  if ($r.data) { $created += $r.data }
}
Assert ($created.Count -eq 5) "5 turnos creados ($($created.Count))"

# ── Contar ANTES ──
$before = C-Get "$BASE/api/admin/reset-agenda" $script:auth
Assert ($before.data.count -ge 5) "Turnos ANTES: $($before.data.count)"

# ── Rechazo sin confirmación ──
$bad = C-Post "$BASE/api/admin/reset-agenda" @{ confirm = "MAL" } $script:auth
Assert ($bad.error -ne $null) "Confirmación incorrecta → rechazada"

# ── Ejecutar reset ──
$reset = C-Post "$BASE/api/admin/reset-agenda" @{ confirm = "REINICIAR" } $script:auth
Assert ($reset.data.appointments -ge 5) "Reset eliminó $($reset.data.appointments) turnos"
Write-Host "  $($reset.data.message)" -ForegroundColor Yellow

# ── Contar DESPUÉS ──
$after = C-Get "$BASE/api/admin/reset-agenda" $script:auth
Assert ($after.data.count -eq 0) "Después del reset: 0 turnos"

# ── Conservación ──
$barbers = C-Get "$BASE/api/barbers"
Assert ($barbers.data.Count -ge 3) "Barberos OK ($($barbers.data.Count))"

$svcs2 = C-Get "$BASE/api/services"
Assert ($svcs2.data.Count -ge 4) "Servicios OK ($($svcs2.data.Count))"

$cfg = C-Get "$BASE/api/settings"
Assert ($cfg.data.shopName -eq "BARBER STUDIO") "Configuración OK"

# ── Reserva post-reset ──
$newSlot = (C-Get "$BASE/api/availability?serviceId=$($corte.id)&date=$date&barberId=any").data.slots[0]
$newAppt = C-Post "$BASE/api/appointments" @{
  serviceId = $corte.id; barberId = "any"; date = $date
  startMin = $newSlot.minute; customerName = "PostReset"; customerPhone = "5491100009999"
}
Assert ($newAppt.data.code.Length -eq 6) "Reserva post-reset: $($newAppt.data.code)"

$final = C-Get "$BASE/api/admin/reset-agenda" $script:auth
Assert ($final.data.count -eq 1) "Ahora hay 1 turno"

# Limpiar
C-Post "$BASE/api/manage/$($newAppt.data.code)/cancel" @{ phone = "5491100009999" }

Write-Host "`n=========================================" -ForegroundColor Cyan
if ($script:failed -eq 0) {
  Write-Host "TODOS LOS TESTS PASARON: $($script:passed)/$($script:passed)" -ForegroundColor Green
} else {
  Write-Host "$($script:failed) fallos de $($script:passed + $script:failed)" -ForegroundColor Red
}