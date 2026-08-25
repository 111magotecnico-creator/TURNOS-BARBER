import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyMercadoPagoPayment } from "@/lib/payments";

// ═════════════════════════════════════════════════════════
// GET /api/payments/success — MercadoPago redirige aquí después del pago.
//
// Flujo: MP → success → fetch pago → redirigir al turno.
// La confirmación real del turno la hace el webhook (IPN).
// Este endpoint es solo para la REDIRECCIÓN del browser.
// ═════════════════════════════════════════════════════════

export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("payment_id");
  const status = url.searchParams.get("status");
  const externalRef = url.searchParams.get("external_reference") ?? "";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  // Si no hay payment_id o no está aprobado, ir al home o al turno
  if (!paymentId || status !== "approved") {
    if (externalRef) {
      return NextResponse.redirect(new URL(`/turno/${externalRef}`, appUrl));
    }
    return NextResponse.redirect(new URL("/", appUrl));
  }

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    if (externalRef) {
      return NextResponse.redirect(new URL(`/turno/${externalRef}`, appUrl));
    }
    return NextResponse.redirect(new URL("/", appUrl));
  }

  try {
    // Verificar el pago en MP (fuente de verdad)
    const payment = await verifyMercadoPagoPayment(paymentId);

    if (payment.status !== "approved") {
      if (externalRef) {
        return NextResponse.redirect(new URL(`/turno/${externalRef}`, appUrl));
      }
      return NextResponse.redirect(new URL("/", appUrl));
    }

    // Obtener el código del turno desde external_reference o metadata
    const appointmentCode =
      payment.external_reference ||
      (payment.metadata as Record<string, unknown>)?.appointmentCode as string;

    if (!appointmentCode) {
      console.error("[SUCCESS] No appointment code found in payment:", paymentId);
      return NextResponse.redirect(new URL("/", appUrl));
    }

    // Verificar que la reserva existe
    const appointment = await prisma.appointment.findUnique({
      where: { code: appointmentCode },
    });

    if (!appointment) {
      console.error("[SUCCESS] Appointment not found:", appointmentCode);
      return NextResponse.redirect(new URL("/", appUrl));
    }

    // Redirigir a la página del turno (el webhook se encargará de confirmarlo)
    return NextResponse.redirect(new URL(`/turno/${appointment.code}`, appUrl));
  } catch (err) {
    console.error("[SUCCESS] Error processing payment success:", err);
    if (externalRef) {
      return NextResponse.redirect(new URL(`/turno/${externalRef}`, appUrl));
    }
    return NextResponse.redirect(new URL("/", appUrl));
  }
}
