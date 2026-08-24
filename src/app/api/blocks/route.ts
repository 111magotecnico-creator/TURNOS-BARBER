import type { NextRequest } from "next/server";
import { handle, ok, HttpError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { blockSchema, dayOffSchema } from "@/validations";

export const dynamic = "force-dynamic";

// ═════════════════════════════════════════════════════════
// Excepciones de agenda: bloqueos puntuales y días libres.
//
// GET  ?date=YYYY-MM-DD[&barberId=] → lista ambos tipos
// POST { type:"block",   barberId, date, startMin, endMin, reason? }
// POST { type:"dayoff",  barberId, date, reason? }
// ═════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const date = sp.get("date");
    const barberId = sp.get("barberId") ?? undefined;

    const [blocks, daysOff] = await Promise.all([
      date
        ? prisma.blockedSlot.findMany({
            where: { date, barberId },
            orderBy: { startMin: "asc" },
          })
        : Promise.resolve([]),
      date
        ? prisma.dayOff.findMany({ where: { date, barberId } })
        : prisma.dayOff.findMany({ orderBy: { date: "asc" }, take: 200 }),
    ]);

    return ok({ blocks, daysOff });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const raw = (await req.json()) as { type?: string };

    if (raw.type === "dayoff") {
      const body = dayOffSchema.parse(raw);
      const created = await prisma.dayOff.upsert({
        where: { barberId_date: { barberId: body.barberId, date: body.date } },
        update: { reason: body.reason ?? null },
        create: body,
      });
      return ok(created, 201);
    }
    if (raw.type === "block") {
      const body = blockSchema.parse(raw);
      return ok(await prisma.blockedSlot.create({ data: body }), 201);
    }
    throw new HttpError(400, 'type debe ser "block" o "dayoff"');
  });
}
