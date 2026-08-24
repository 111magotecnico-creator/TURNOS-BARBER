import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { adminUpdate, hardDelete, getAppointment } from "@/services/appointments.service";
import { appointmentUpdateSchema } from "@/validations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Admin: detalle completo de un turno. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    return ok(await getAppointment(id));
  });
}

/**
 * Admin: edición general (datos del cliente, notas) + cambio de
 * horario/barbero/servicio (re-valida solapamiento excluyéndose a sí
 * mismo) + cambios de estado (COMPLETED / CANCELLED).
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = appointmentUpdateSchema.parse(await req.json());
    return ok(await adminUpdate(id, body));
  });
}

/** Admin: borrado físico definitivo. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    return ok(await hardDelete(id));
  });
}
