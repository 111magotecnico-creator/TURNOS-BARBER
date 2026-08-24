import { NextResponse } from "next/server";
import { ZodError } from "zod";

// ═════════════════════════════════════════════════════════
// Infraestructura HTTP uniforme para todos los endpoints:
//   ok(data)          → { data } status 200
//   HttpError(n, msg) → { error } con el status indicado
//   handle(fn)        → captura todo y mapea a JSON consistente
// Nunca se ocultan errores: los inesperados van al log.
// ═════════════════════════════════════════════════════════

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: { message: err.message, code: err.code ?? "ERROR" } },
      { status: err.status }
    );
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path?.join(".");
    return NextResponse.json(
      {
        error: {
          message: `${field ? field + ": " : ""}${first?.message ?? "Datos inválidos"}`,
          code: "VALIDATION",
        },
      },
      { status: 400 }
    );
  }
  console.error("[API] Error inesperado:", err);
  return NextResponse.json(
    { error: { message: "Error interno del servidor" } },
    { status: 500 }
  );
}

export async function handle(
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    return errorResponse(err);
  }
}
