import type { NextRequest } from "next/server";
import { handle, ok, HttpError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { resetAgenda, countActiveAppointments } from "@/services/reset.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Validación server-side: el cliente debe enviar
// { confirm: "REINICIAR" } exactamente.
const resetSchema = z.object({
  confirm: z.literal("REINICIAR"),
});

/**
 * POST /api/admin/reset-agenda
 * Borra todos los turnos + pagos + clientes huérfanos.
 * Requiere ADMIN + body { confirm: "REINICIAR" }.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();

    const raw = (await req.json()) as { confirm?: string };
    const parsed = resetSchema.safeParse(raw);

    if (!parsed.success) {
      throw new HttpError(
        400,
        'Confirmación inválida. Debés escribir exactamente "REINICIAR".',
        "INVALID_CONFIRM"
      );
    }

    const before = await countActiveAppointments();
    console.log(`[RESET] Iniciando reinicio de agenda (${before} turnos)...`);

    const result = await resetAgenda();

    console.log(
      `[RESET] Completado: ${result.payments} pagos, ${result.appointments} turnos, ${result.customers} clientes.`
    );

    return ok({
      message: `Agenda reiniciada correctamente. Se eliminaron ${result.appointments} turnos.`,
      ...result,
    });
  });
}

/**
 * GET /api/admin/reset-agenda
 * Devuelve la cantidad actual de turnos (para la UI antes del reset).
 */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const count = await countActiveAppointments();
    return ok({ count });
  });
}
