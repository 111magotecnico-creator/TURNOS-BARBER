import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { confirmPaymentBooking } from "@/services/appointments.service";

/**
 * GET /api/payments/success?payment_id=123&status=approved
 *
 * MercadoPago redirige al usuario aquí después de un pago.
 * Consultamos los datos del pago vía API de MP para obtener
 * los metadata con los datos de la reserva, y creamos el turno
 * como CONFIRMED solo si el pago fue aprobado.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("payment_id");
  const status = url.searchParams.get("status");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  // Sin payment_id o pago no aprobado → al home
  if (!paymentId || status !== "approved") {
    return NextResponse.redirect(new URL("/", appUrl));
  }

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.redirect(new URL("/", appUrl));
  }

  try {
    // Consultar datos del pago a la API de MercadoPago
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!mpRes.ok) {
      console.error("[PAYMENTS] Error fetching payment from MP:", mpRes.status);
      return NextResponse.redirect(new URL("/", appUrl));
    }

    const payment = (await mpRes.json()) as {
      id: number;
      status: string;
      transaction_amount: number;
      currency_id: string;
      external_reference?: string;
      metadata?: Record<string, unknown>;
    };

    if (payment.status !== "approved") {
      return NextResponse.redirect(new URL("/", appUrl));
    }

    // Extraer datos de reserva del metadata
    const meta = payment.metadata;
    if (
      !meta ||
      !meta.serviceId ||
      !meta.date ||
      !meta.startMin ||
      !meta.customerName ||
      !meta.customerPhone
    ) {
      console.error("[PAYMENTS] Invalid metadata in payment:", paymentId);
      return NextResponse.redirect(new URL("/", appUrl));
    }

    // Crear el turno (ya CONFIRMADO + pago APPROVED)
    const appointment = await confirmPaymentBooking({
      serviceId: meta.serviceId as string,
      barberId: (meta.barberId as string) ?? "any",
      date: meta.date as string,
      startMin: meta.startMin as number,
      customerName: meta.customerName as string,
      customerPhone: meta.customerPhone as string,
      customerEmail: (meta.customerEmail as string) ?? null,
      notes: (meta.notes as string) ?? null,
      paymentExternalId: String(payment.id),
      paymentAmount: payment.transaction_amount,
      paymentCurrency: payment.currency_id,
    });

    // Redirigir a la página del turno confirmado
    return NextResponse.redirect(
      new URL(`/turno/${appointment.code}`, appUrl)
    );
  } catch (err) {
    console.error("[PAYMENTS] Error processing payment success:", err);
    return NextResponse.redirect(new URL("/", appUrl));
  }
}
