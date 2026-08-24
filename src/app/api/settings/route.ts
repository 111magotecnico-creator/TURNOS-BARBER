import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { getSettings, updateSettings } from "@/services/settings.service";
import { settingsUpdateSchema } from "@/validations";

export const dynamic = "force-dynamic";

/** Público: datos de la barbería para el sitio (sin secretos). */
export async function GET() {
  return handle(async () => ok(await getSettings()));
}

/** Admin: actualizar configuración. */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const body = settingsUpdateSchema.parse(await req.json());
    return ok(await updateSettings(body));
  });
}
