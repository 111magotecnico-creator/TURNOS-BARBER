import { NextResponse } from "next/server";

// ═════════════════════════════════════════════════════════
// GET /api/payments/pending — MercadoPago redirige aquí si el pago queda pendiente
// (ej: pago en efectivo, transferencia bancaria).
// El turno queda en PENDING_PAYMENT hasta que el webhook confirme.
// ═════════════════════════════════════════════════════════

export async function GET(req: Request) {
  const url = new URL(req.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const externalRef = url.searchParams.get("external_reference") ?? "";

  if (externalRef) {
    return NextResponse.redirect(new URL(`/turno/${externalRef}`, appUrl));
  }

  return NextResponse.redirect(new URL("/", appUrl));
}
