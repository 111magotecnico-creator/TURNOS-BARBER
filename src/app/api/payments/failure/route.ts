import { NextResponse } from "next/server";

// ═════════════════════════════════════════════════════════
// GET /api/payments/failure — MercadoPago redirige aquí si el pago falla.
// El turno queda en PENDING_PAYMENT y el cliente puede reintentar.
// ═════════════════════════════════════════════════════════

export async function GET(req: Request) {
  const url = new URL(req.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const externalRef = url.searchParams.get("external_reference") ?? "";

  // Redirigir a la página del turno si tenemos el código
  if (externalRef) {
    return NextResponse.redirect(new URL(`/turno/${externalRef}`, appUrl));
  }

  // Si no hay referencia, ir al home
  return NextResponse.redirect(new URL("/", appUrl));
}
