import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/blocks/[id]?type=block|dayoff */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const type = req.nextUrl.searchParams.get("type");

    if (type === "dayoff") {
      await prisma.dayOff.deleteMany({ where: { id } });
    } else {
      await prisma.blockedSlot.deleteMany({ where: { id } });
    }
    return ok({ deleted: true });
  });
}
