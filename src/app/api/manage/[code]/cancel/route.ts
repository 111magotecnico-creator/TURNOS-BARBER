import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/http";
import { cancelByCode } from "@/services/appointments.service";
import { manageCancelSchema } from "@/validations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/** Público: cancelar turno — código + teléfono de seguridad. */
export async function POST(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { code } = await ctx.params;
    const body = manageCancelSchema.parse(await req.json());
    return ok(await cancelByCode(code, body.phone, body.reason));
  });
}
