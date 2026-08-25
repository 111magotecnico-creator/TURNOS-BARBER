import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyMercadoPagoPayment } from "@/lib/payments";
import { APPOINTMENT_STATUS } from "@/config";
import { notifyAppointment } from "@/lib/whatsapp";
import { formatDateLong, formatMoney, minToTime } from "@/lib/utils";
import { getSettings } from "@/services/settings.service";

// ═════════════════════════════════════════════════════════
// WEBHOOK DE MERCADOPAGO (IPN — Instant Payment Notification)
//
// MP envía POST cuando cambia el estado de un pago.
// Este endpoint:
//   1. Recibe la notificación (payment_id o topic=payment)
//   2. Consulta el estado REAL del pago vía API de MP
//   3. Busca la reserva por external_reference o preference_id
//   4. Actualiza Payment.status + Appointment.status
//   5. Es idempotente: procesar la misma notificación 2 veces no duplica nada
//
// SEGURIDAD: No confiar en los parámetros query — siempre verificar
// el pago consultando la API de MercadoPago con el Access Token.
// ═════════════════════════════════════════════════════════

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const body = await req.text();

    // MP envía diferentes formatos según el tipo de notificación
    let paymentId: string | null = null;

    // Intentar parsear como JSON (webhook type=v2)
    try {
      const json = JSON.parse(body);
      if (json.type === "payment") {
        paymentId = String(json.data?.id ?? "");
      }
      // type=payment (v1) también viene como query param
      if (json.action === "payment.created" && json.data?.id) {
        paymentId = String(json.data.id);
      }
    } catch {
      // No es JSON válido, puede ser form-encoded
    }

    // Query params (v1 style)
    if (!paymentId) {
      paymentId = url.searchParams.get("id") ?? url.searchParams.get("payment_id");
    }
    const topic = url.searchParams.get("topic");

    // Si no hay payment_id pero hay topic=payment, MP notifica que hubo cambios
    if (!paymentId && topic === "payment") {
      // MP v1 envía solo topic sin id; debemos ignorar o buscar recientes
      // En v2 siempre viene el id. Si no tenemos id, respondemos 200 para evitar reintentos.
      console.log("[WEBHOOK] Received topic=payment without id, acknowledging");
      return NextResponse.json({ ok: true });
    }

    if (!paymentId) {
      console.log("[WEBHOOK] No payment_id found, acknowledging");
      return NextResponse.json({ ok: true });
    }

    // Verificar el pago en la API de MercadoPago (fuente de verdad)
    const payment = await verifyMercadoPagoPayment(paymentId);

    console.log(
      `[WEBHOOK] Payment ${payment.id}: status=${payment.status}, amount=${payment.transaction_amount}, ref=${payment.external_reference}`
    );

    // Buscar la reserva por external_reference (appointment code)
    const appointmentCode = payment.external_reference;
    if (!appointmentCode) {
      console.error("[WEBHOOK] No external_reference in payment:", paymentId);
      return NextResponse.json({ ok: true });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { code: appointmentCode },
      include: { payment: true, service: true, barber: true },
    });

    if (!appointment) {
      console.error("[WEBHOOK] Appointment not found for code:", appointmentCode);
      return NextResponse.json({ ok: true });
    }

    // IDEMPOTENCIA: si ya está aprobado, no hacer nada
    if (appointment.payment?.status === "APPROVED") {
      console.log("[WEBHOOK] Payment already processed, skipping");
      return NextResponse.json({ ok: true });
    }

    // Verificar monto
    if (appointment.payment && payment.transaction_amount !== appointment.payment.amount) {
      console.error(
        `[WEBHOOK] Amount mismatch: expected ${appointment.payment.amount}, got ${payment.transaction_amount}`
      );
      return NextResponse.json({ ok: true });
    }

    // Actualizar según estado del pago
    const settings = await getSettings();

    if (payment.status === "approved") {
      // PAGO APROBADO → confirmar turno
      await prisma.$transaction(async (tx) => {
        // Doble verificación dentro de transacción
        const current = await tx.appointment.findUnique({
          where: { id: appointment.id },
          include: { payment: true },
        });
        if (current?.payment?.status === "APPROVED") {
          return; // Ya procesado
        }

        await tx.payment.update({
          where: { appointmentId: appointment.id },
          data: {
            status: "APPROVED",
            externalId: String(payment.id),
            paymentMethod: payment.payment_method_id ?? null,
            paidAt: payment.date_approved ? new Date(payment.date_approved) : new Date(),
            currency: payment.currency_id,
          },
        });

        await tx.appointment.update({
          where: { id: appointment.id },
          data: { status: APPOINTMENT_STATUS.CONFIRMED },
        });
      });

      // Notificar por WhatsApp después de confirmar
      const full = await prisma.appointment.findUnique({
        where: { id: appointment.id },
        include: { service: true, barber: true },
      });
      if (full) {
        const depositAmount = resolveAmount(
          settings.paymentMode,
          full.service.price,
          settings.depositPercent
        );
        const remaining = full.service.price - depositAmount;
        void notifyAppointment("confirmed", {
          shopName: settings.shopName,
          customerName: full.customerName,
          customerPhone: full.customerPhone,
          serviceName: full.service.name,
          barberName: full.barber.name,
          dateLong: formatDateLong(full.date),
          time: minToTime(full.startMin),
          price: full.service.price,
          currency: settings.currency,
          manageUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/turno/${full.code}`,
          depositAmount,
          remainingBalance: remaining > 0 ? remaining : undefined,
        });
      }

      console.log(`[WEBHOOK] Appointment ${appointmentCode} CONFIRMED`);
    } else if (payment.status === "rejected" || payment.status === "cancelled") {
      // PAGO RECHAZADO/CANCELADO → marcar pago como rechazado, turno permanece PENDING_PAYMENT
      await prisma.payment.update({
        where: { appointmentId: appointment.id },
        data: {
          status: "REJECTED",
          externalId: String(payment.id),
        },
      });

      console.log(`[WEBHOOK] Payment ${paymentId} ${payment.status} for ${appointmentCode}`);
    } else {
      // Otros estados (pending, in_process, etc.) → mantener PENDING
      console.log(`[WEBHOOK] Payment ${paymentId} status=${payment.status}, waiting`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[WEBHOOK] Error processing webhook:", err);
    // Siempre responder 200 para que MP no reintente infinitamente
    return NextResponse.json({ ok: true });
  }
}

// MercadoPago también envía GET para verificar que el endpoint está vivo
export async function GET() {
  return NextResponse.json({ status: "ok", service: "barber-payments-webhook" });
}

function resolveAmount(mode: string, price: number, depositPercent: number): number {
  if (mode === "DEPOSIT") {
    return Math.max(1, Math.round((price * depositPercent) / 100));
  }
  return price;
}
