"use client";

import { useEffect, useState } from "react";
import { EmptyState, Spinner } from "@/components/ui/States";
import { apiFetch } from "@/lib/client";
import type { CustomerListItem } from "@/services/customers.service";

// ═════════════════════════════════════════════════════════
// CLIENTES — construido solo a partir de las reservas.
// Búsqueda por nombre/teléfono + contacto directo por WhatsApp.
// ═════════════════════════════════════════════════════════

export default function ClientesPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [customers, setCustomers] = useState<CustomerListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce para no pegarle a la API en cada tecla
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = `/api/customers${debounced.trim() ? `?q=${encodeURIComponent(debounced.trim())}` : ""}`;
    apiFetch<CustomerListItem[]>(url)
      .then((data) => { if (!cancelled) setCustomers(data); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold">Clientes</h1>
        <p className="text-sm text-muted">
          Se cargan automáticamente con cada reserva
          {customers ? ` · ${customers.length}` : ""}
        </p>
      </header>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o teléfono…"
        className="mb-5 w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-accent"
      />

      {loading && !customers && <Spinner label="Buscando clientes..." />}
      {error && <ErrorBox message={error} />}
      {!loading && customers?.length === 0 && (
        <EmptyState title="Sin clientes todavía" hint="Aparecerán acá cuando llegue la primera reserva." />
      )}

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {customers?.map((c) => (
          <li key={c.id} className="flex items-center gap-3.5 rounded-card border border-line bg-surface p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-base font-bold text-accent">
              {c.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.name}</p>
              <p className="truncate text-xs text-muted">{c.phone}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {c.visits} visita{c.visits === 1 ? "" : "s"}
                {c.lastVisit ? ` · última ${formatDate(c.lastVisit)}` : ""}
              </p>
            </div>
            <a
              href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Escribir a ${c.name}`}
              className="rounded-xl border border-line px-3 py-2 text-lg leading-none transition hover:border-success hover:text-success"
            >
              💬
            </a>
          </li>
        ))}
      </ul>

      {loading && customers && (
        <p className="mt-3 text-center text-xs text-muted">Actualizando…</p>
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {message}
    </p>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}
