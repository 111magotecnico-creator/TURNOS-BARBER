import type { NextRequest } from "next/server";
import { handle, ok, HttpError } from "@/lib/http";
import { getByCodePublic, rescheduleByCode } from "@/services/appointments.service";
import { manageRescheduleSchema } from "@/validations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/**
 * GET público: vista limitada del turno (sin teléfono/email completos).
 * PUT público: reprogramar — exige código + teléfono que coincida;
 * re-valida el nuevo horario y ACTUALIZA el turno (nunca duplica).
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { code } = await ctx.params;
    return ok(await getByCodePublic(code));
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { code } = await ctx.params;
    const body = manageRescheduleSchema.parse(await req.json());
    return ok(await rescheduleByCode(code, body.phone, body.date, body.startMin));
  });
}
