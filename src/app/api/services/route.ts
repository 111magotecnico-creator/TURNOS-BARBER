import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { createService, listServices } from "@/services/services.service";
import { serviceUpsertSchema } from "@/validations";

export const dynamic = "force-dynamic";

/** Público: servicios activos. Admin (?all=1): todos. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const all = req.nextUrl.searchParams.get("all") === "1";
    if (all) await requireAdmin();
    return ok(await listServices(all));
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const body = serviceUpsertSchema.parse(await req.json());
    return ok(await createService(body), 201);
  });
}
