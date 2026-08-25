import type { NextRequest } from "next/server";
import { handle, ok, HttpError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createBooking,
  listAppointments,
} from "@/services/appointments.service";
import { bookingCreateSchema } from "@/validations";

export const dynamic = "force-dynamic";

/**
 * GET (admin): agenda con filtros from/to/barberId/status/phone.
 * POST (público): crea un turno. Re-valida TODO en el servidor y
 * rechaza superposiciones dentro de una transacción.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = bookingCreateSchema.parse(await req.json());
    const result = await createBooking(body);
    // Si hay pago online: devolver turno PENDING_PAYMENT + datos del pago
    if (result.payment) {
      return ok(
        {
          appointment: {
            id: result.appointment.id,
            code: result.appointment.code,
            status: result.appointment.status,
            date: result.appointment.date,
            startMin: result.appointment.startMin,
            endMin: result.appointment.endMin,
            barberName: result.appointment.barber.name,
            serviceName: result.appointment.service.name,
            servicePrice: result.appointment.service.price,
          },
          payment: result.payment,
        },
        201
      );
    }
    // Sin pago online: devolver turno confirmado
    return ok(result.appointment, 201);
  });
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const appointments = await listAppointments({
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      barberId: sp.get("barberId") ?? undefined,
      status: sp.get("status") ?? undefined,
      customerIdPhone: sp.get("phone") ?? undefined,
    });

    // Enriquecer con datos de pago para el admin
    const enriched = await Promise.all(
      appointments.map(async (a) => {
        const payment = await prisma.payment.findUnique({
          where: { appointmentId: a.id },
        });
        return { ...a, payment };
      })
    );

    return ok(enriched);
  });
}
