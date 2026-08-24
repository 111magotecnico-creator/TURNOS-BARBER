import type { NextRequest } from "next/server";
import { handle, ok, HttpError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { createBarber, listBarbers } from "@/services/barbers.service";
import { barberUpsertSchema } from "@/validations";

export const dynamic = "force-dynamic";

/** Público: barberos activos. Admin (?all=1): todos. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const all = req.nextUrl.searchParams.get("all") === "1";
    if (all) await requireAdmin();
    return ok(await listBarbers(all));
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const body = barberUpsertSchema.parse(await req.json());
    return ok(await createBarber(body), 201);
  });
}
