import { handle, ok } from "@/lib/http";
import { isMercadoPagoConfigured } from "@/lib/payments";

// ═════════════════════════════════════════════════════════
// GET /api/settings/mp-status — Indica si MercadoPago está configurado.
// Solo verifica que exista el Access Token (no lo expone).
// ═════════════════════════════════════════════════════════

export async function GET() {
  return handle(async () => {
    return ok({ configured: isMercadoPagoConfigured() });
  });
}
