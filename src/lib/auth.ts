import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { HttpError } from "@/lib/http";
import {
  SESSION_COOKIE,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/jwt";

// ═════════════════════════════════════════════════════════
// Sesión de administrador: JWT firmado en cookie httpOnly
// (inaccesible desde JS del navegador → mitiga XSS),
// contraseñas con bcrypt. Autorización por rol en cada
// endpoint sensible mediante requireAdmin().
// ═════════════════════════════════════════════════════════

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

export { SESSION_COOKIE };

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Guarda para endpoints de administración. Lanza 401/403. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "No autenticado");
  if (session.role !== "ADMIN") throw new HttpError(403, "Sin permisos");
  return session;
}
