# ═════════════════════════════════════════════════════════
# SMOKE TEST E2E — flujo completo de reserva contra la API real
# Uso: servidor dev corriendo en localhost:3000
# Ejecutar: powershell -File scripts\smoke-api.ps1
# ═════════════════════════════════════════════════════════

$BASE = "http://localhost:3000/api"
$script:passed = 0
$script:failed = 0

function Assert($cond, $msg) {
  if ($cond) { $script:passed++; Write-Host "  PASS  $msg" -ForegroundColor Green }
  else       { $script:failed++; Write-Host "  FAIL  $msg" -ForegroundColor Red }
}

function Invoke-Api($Method, $Uri, $Body, $CookieHeader) {
  try {
    $p = @{ Method = $Method; Uri = $Uri; UseBasicParsing = $true }
    if ($Body)         { $p.Body = ($Body | ConvertTo-Json -Depth 6); $p.ContentType = "application/json" }
    if ($CookieHeader) { $p.Headers = @{ Cookie = $CookieHeader } }
    $r = Invoke-RestMethod @p
    return @{ ok = $true; data = $r.data }
  } catch {
    $resp = $_.Exception.Response
    if (-not $resp) { throw $_ }
    $status = [int]$resp.StatusCode
    try { $body = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() | ConvertFrom-Json } catch { $body = $null }
    return @{ ok = $false; status = $status; error = $body.error.message }
  }
}

Write-Host "`n== 1. Configuracion publica =="
$r = Invoke-Api GET "$BASE/settings"
Assert ($r.ok -and $r.data.shopName -eq "BARBER STUDIO") "GET /settings devuelve BARBER STUDIO"

Write-Host "`n== 2. Catalogo publico =="
$services = (Invoke-Api GET "$BASE/services").data
$barbers  = (Invoke-Api GET "$BASE/barbers").data
Assert ($services.Count -ge 4) "4 servicios activos"
Assert ($barbers.Count -eq 3) "3 barberos activos"
$corte = $services | Where-Object { $_.name -eq "Corte" }

# Buscar la primera fecha con ≥2 barberos libres en un slot
# (necesario para probar asignación 'any' y doble reserva).
$date = $null
$slot = $null
for ($i = 1; $i -le 14; $i++) {
  $d = (Get-Date).Date.AddDays($i)
  if ($d.DayOfWeek -eq [DayOfWeek]::Sunday) { continue }
  $testDate = $d.ToString("yyyy-MM-dd")
  $testAv = (Invoke-Api GET "$BASE/availability?serviceId=$($corte.id)&date=$testDate").data
  $testSlot = $testAv.slots | Where-Object { $_.barberIds.Count -ge 2 } | Select-Object -First 1
  if ($testSlot) { $date = $testDate; $slot = $testSlot; break }
}
if (-not $date) { Write-Host " No se encontró fecha con ≥2 barberos" -ForegroundColor Red; exit 1 }
Write-Host "  (probando con fecha $date)"

Write-Host "`n== 3. Disponibilidad calculada automaticamente =="
$av = (Invoke-Api GET "$BASE/availability?serviceId=$($corte.id)&date=$date").data
Assert ($av.slots.Count -gt 10) "$($av.slots.Count) slots disponibles para 'Corte' (30min)"
Write-Host "  slot elegido: $($slot.time) (barberos libres: $($slot.barberIds.Count))"

Write-Host "`n== 4. Reserva publica (cualquier barbero) =="
$booking = Invoke-Api POST "$BASE/appointments" @{
  serviceId     = $corte.id
  barberId      = "any"
  date          = $date
  startMin      = $slot.minute
  customerName  = "Pedro Prueba"
  customerPhone = "+54 9 11 4444-9999"
  customerEmail = ""
}
Assert ($booking.ok -and $booking.data.code.Length -eq 6) "POST /appointments crea el turno con codigo $($booking.data.code)"
$assignedBarberId = $booking.data.barber.id
Write-Host "  asignado a: $($booking.data.barber.name)"

Write-Host "`n== 5. El barbero asignado deja de estar libre en ese slot =="
Start-Sleep -Milliseconds 500
$av2 = (Invoke-Api GET "$BASE/availability?serviceId=$($corte.id)&date=$date").data
$stillThere = $av2.slots | Where-Object { $_.minute -eq $slot.minute }
Assert ($null -eq $stillThere -or ($stillThere.barberIds -notcontains $assignedBarberId)) "$($booking.data.barber.name) ya no figura libre a las $($slot.time)"

Write-Host "`n== 6. DOBLE RESERVA debe fallar con 409 =="
$dbl = Invoke-Api POST "$BASE/appointments" @{
  serviceId     = $corte.id
  barberId      = $assignedBarberId
  date          = $date
  startMin      = $slot.minute
  customerName  = "Atacante Malicioso"
  customerPhone = "555666777"
}
Assert (-not $dbl.ok -and $dbl.status -eq 409) "reserva superpuesta rechazada (409: $($dbl.error))"

Write-Host "`n== 7. Slot libre para OTRO barbero ('any' lo asigna solo) =="
$b2 = Invoke-Api POST "$BASE/appointments" @{
  serviceId     = $corte.id
  barberId      = "any"
  date          = $date
  startMin      = $slot.minute
  customerName  = "Ana Lopez"
  customerPhone = "555888111"
}
Assert ($b2.ok -and $b2.data.barber.id -ne $assignedBarberId) "segundo cliente asignado a otro barbero: $($b2.data.barber.name)"

Write-Host "`n== 8. Gestion sin cuenta: reprogramar y cancelar por codigo =="
$code = $booking.data.code
# El slot nuevo debe estar libre para EL BARBERO ASIGNADO (la
# reprogramacion conserva el profesional; 'any' ofreceria slots de otros).
$freeSlots = $av2.slots | Where-Object { $_.minute -ne $slot.minute -and $_.barberIds -contains $assignedBarberId }
$newSlot = $freeSlots[1]
$wrong = Invoke-Api PUT "$BASE/manage/$code" @{ phone = "000000000"; date = $date; startMin = $newSlot.minute }
Assert (-not $wrong.ok -and $wrong.status -eq 403) "telefono incorrecto rechazado (403)"
$resch = Invoke-Api PUT "$BASE/manage/$code" @{ phone = "5491144449999"; date = $date; startMin = $newSlot.minute }
Assert ($resch.ok -and $resch.data.startMin -eq $newSlot.minute) "reprogramado al slot $($newSlot.time) (mismo turno, sin duplicar)"
$pub = Invoke-Api GET "$BASE/manage/$code"
Assert ($pub.ok -and $pub.data.startTime -eq $newSlot.time) "consulta publica por codigo muestra la nueva hora"
$cancel = Invoke-Api POST "$BASE/manage/$code/cancel" @{ phone = "5491144449999"; reason = "No puedo ir" }
Assert ($cancel.ok -and $cancel.data.status -eq "CANCELLED") "cancelacion por codigo OK"
$av3 = (Invoke-Api GET "$BASE/availability?serviceId=$($corte.id)&date=$date").data
$freed = $av3.slots | Where-Object { $_.minute -eq $newSlot.minute }
Assert ($null -ne $freed) "al cancelarse, el slot $($newSlot.time) vuelve a estar disponible"

Write-Host "`n== 9. Seguridad del panel admin =="
$bad = Invoke-Api POST "$BASE/auth/login" @{ email = "admin@barberstudio.com"; password = "incorrecta" }
Assert (-not $bad.ok -and $bad.status -eq 401) "login con password incorrecta -> 401"
$anon = Invoke-Api GET "$BASE/appointments?from=$date"
Assert (-not $anon.ok -and $anon.status -eq 401) "listado de turnos sin sesion -> 401"

# Login con curl.exe (evita los quirks de manejo de cookies de PS 5.1)
$loginBody = '{\"email\":\"admin@barberstudio.com\",\"password\":\"admin123\"}'
$resp = curl.exe -s -i -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d $loginBody
$setCookieLine = ($resp | Select-String "^set-cookie:").Line
$loginOk = (($resp | Select-String "^HTTP").Line) -match " 200"
if ($setCookieLine -match "bs_session=([^;]+)") { $auth = "bs_session=$($Matches[1])" } else { $auth = "" }
Assert ($loginOk -and $auth) "login admin OK (cookie httpOnly firmada)"

$listJson = curl.exe -s "$BASE/appointments?from=$date&to=$date" -H "Cookie: $auth"
$listData = ($listJson | ConvertFrom-Json).data
Assert ($listData.Count -ge 2) "agenda admin lista los turnos del dia ($($listData.Count))"

$statsJson = curl.exe -s "$BASE/stats" -H "Cookie: $auth"
$statsData = ($statsJson | ConvertFrom-Json).data
Assert ($null -ne $statsData.currency) "dashboard stats responden (moneda $($statsData.currency))"

Write-Host "`n== 10. Limpieza (la corrida no deja estado residual) =="
# La reserva de 'Ana Lopez' (sec.7) se cancela para que las proximas
# corridas partan de una agenda identica -> suite determinista.
$clean = Invoke-Api POST "$BASE/manage/$($b2.data.code)/cancel" @{ phone = "555888111"; reason = "Limpieza smoke test" }
Assert ($clean.ok) "reserva de prueba cancelada (suite autolimpiante)"

Write-Host "`n========================================="
if ($script:failed -eq 0) {
  Write-Host "E2E COMPLETO: $($script:passed)/$($script:passed) pruebas pasaron" -ForegroundColor Green
  exit 0
} else {
  Write-Host "$($script:failed) fallos de $($script:passed + $script:failed)" -ForegroundColor Red
  exit 1
}
