import { handle, ok } from "@/lib/http";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await getSession();
    return ok(session); // null si no hay sesión
  });
}
