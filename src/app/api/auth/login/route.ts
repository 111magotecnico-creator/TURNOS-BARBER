import type { NextRequest } from "next/server";
import { handle, ok, HttpError } from "@/lib/http";
import { createSession, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/validations";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Rate-limit básico en memoria (dev/mono-instancia).
// En producción con múltiples instancias usar Redis.
const attempts = new Map<string, { count: number; until: number }>();

function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.until < now) {
    attempts.set(key, { count: 1, until: now + windowMs });
    return;
  }
  rec.count++;
  if (rec.count > max) {
    throw new HttpError(429, "Demasiados intentos. Probá de nuevo en unos minutos.");
  }
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);

    const body = loginSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    const valid = await verifyPassword(body.password, user?.passwordHash);
    if (!user || !valid) {
      throw new HttpError(401, "Email o contraseña incorrectos");
    }

    await createSession({ sub: user.id, name: user.name, role: user.role });
    return ok({ id: user.id, name: user.name, role: user.role });
  });
}
