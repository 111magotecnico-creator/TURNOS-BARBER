import { SignJWT, jwtVerify } from "jose";

// ═════════════════════════════════════════════════════════
// Firma/verificación JWT. Archivo separado de auth.ts para
// poder importarlo desde el middleware (edge runtime) sin
// arrastrar dependencias de next/headers.
// ═════════════════════════════════════════════════════════

export const SESSION_COOKIE = "bs_session";

export interface SessionPayload {
  sub: string; // user id
  name: string;
  role: string;
  [key: string]: unknown; // compatible con JWTPayload
}

const secret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET ?? "insecure-dev-secret-change-me-32chars!!"
  );

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      name: String(payload.name ?? ""),
      role: String(payload.role ?? ""),
    };
  } catch {
    return null;
  }
}
