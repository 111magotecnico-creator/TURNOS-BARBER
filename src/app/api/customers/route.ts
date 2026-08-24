import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { listCustomers } from "@/services/customers.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const q = req.nextUrl.searchParams.get("q") ?? undefined;
    return ok(await listCustomers(q));
  });
}
