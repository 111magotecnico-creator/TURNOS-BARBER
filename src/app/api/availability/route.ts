import type { NextRequest } from "next/server";
import { handle, ok, HttpError } from "@/lib/http";
import { getAvailability } from "@/services/availability.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/availability?serviceId=...&date=YYYY-MM-DD&barberId=...|any
 * Público. Devuelve los horarios REALMENTE disponibles.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const sp = req.nextUrl.searchParams;
    const serviceId = sp.get("serviceId");
    const date = sp.get("date");
    if (!serviceId) throw new HttpError(400, "Falta serviceId");
    if (!date) throw new HttpError(400, "Falta date");

    const result = await getAvailability({
      serviceId,
      date,
      barberId: sp.get("barberId") ?? undefined,
    });
    return ok(result);
  });
}
