# scripts/expire-pending.ps1
# Expira turnos PENDING_PAYMENT cuyo tiempo límite pasó.
# Ejecutar periódicamente (cada 1-5 minutos) via cron o tarea programada.
#
# Uso:
#   ./scripts/expire-pending.ps1                    # llama a la API (requiere admin autenticado)
#   DATABASE_URL="..." node scripts/expire-pending.cjs  # directo contra la DB

param(
  [string]$AppUrl = "https://turnos-barber.vercel.app",
  [string]$AdminToken = ""
)

$headers = @{}
if ($AdminToken) {
  $headers["Authorization"] = "Bearer $AdminToken"
}

try {
  $result = Invoke-RestMethod -Uri "$AppUrl/api/admin/expire" -Method POST -Headers $headers
  Write-Host "[EXPIRE] $($result.message)"
} catch {
  Write-Host "[EXPIRE] Error: $_"
  exit 1
}
