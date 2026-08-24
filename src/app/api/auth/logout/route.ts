import { handle, ok } from "@/lib/http";
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — borra la cookie de sesión. */
export async function POST() {
  return handle(async () => {
    await destroySession();
    return ok({ loggedOut: true });
  });
}
