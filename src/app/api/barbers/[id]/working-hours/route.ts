import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { replaceWorkingHours } from "@/services/barbers.service";
import { workingHoursSchema } from "@/validations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = workingHoursSchema.parse(await req.json());
    return ok(await replaceWorkingHours(id, body.items));
  });
}
