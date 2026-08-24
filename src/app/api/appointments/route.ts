import type { NextRequest } from "next/server";
import { handle, ok, HttpError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
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
    // Si hay pago online: devolver solo los datos del pago (sin turno aún)
    if (result.payment && !result.appointment) {
      return ok({ payment: result.payment }, 201);
    }
    // Si no hay pago online: devolver el turno confirmado
    return ok(result.appointment, 201);
  });
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    return ok(
      await listAppointments({
        from: sp.get("from") ?? undefined,
        to: sp.get("to") ?? undefined,
        barberId: sp.get("barberId") ?? undefined,
        status: sp.get("status") ?? undefined,
        customerIdPhone: sp.get("phone") ?? undefined,
      })
    );
  });
}
