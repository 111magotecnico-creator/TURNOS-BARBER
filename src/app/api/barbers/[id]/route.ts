import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import {
  deleteBarber,
  getBarberDetail,
  updateBarber,
} from "@/services/barbers.service";
import { barberUpsertSchema } from "@/validations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    return ok(await getBarberDetail(id));
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = barberUpsertSchema.parse(await req.json());
    return ok(await updateBarber(id, body));
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    return ok(await deleteBarber(id));
  });
}
