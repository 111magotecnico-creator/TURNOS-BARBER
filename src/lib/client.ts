"use client";

// Cliente HTTP uniforme para el frontend.
// Desenvuelve el formato estándar { data } y lanza errores legibles.

export async function apiFetch<T>(
  url: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const payload = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!res.ok) {
    throw new Error(payload?.error?.message ?? "Error de conexión");
  }
  return payload?.data as T;
}
