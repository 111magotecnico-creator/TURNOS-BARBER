"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, Spinner } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/client";
import { formatDateShort, formatMoney, todayStr } from "@/lib/utils";
import type { AppointmentDTO, BarberDTO, SettingsDTO } from "@/types";

// ═════════════════════════════════════════════════════════
// TURNOS — historial completo con filtros por fecha/estado/
// barbero/búsqueda de cliente. Acciones rápidas por fila.
// ═════════════════════════════════════════════════════════

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export default function TurnosPage() {
  const today = todayStr();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState("");
  const [barberId, setBarberId] = useState("");
  const [q, setQ] = useState("");

  const params = new URLSearchParams({ from, to });
  if (status) params.set("status", status);
  if (barberId) params.set("barberId", barberId);
  if (q.trim()) params.set("q", q.trim());

  const { data: appointments, loading, refresh } = useApi<AppointmentDTO[]>(
    `/api/appointments?${params.toString()}`
  );
  const { data: barbers } = useApi<BarberDTO[]>("/api/barbers");
  const { data: settings } = useApi<SettingsDTO>("/api/settings");

  async function changeStatus(a: AppointmentDTO, next: string) {
    if (next === "CANCELLED" && !confirm(`¿Cancelar turno de ${a.customerName}?`)) return;
    await apiFetch(`/api/appointments/${a.id}`, {
      method: "PATCH",
      json:
        next === "CANCELLED"
          ? { status: next, cancelReason: "Cancelado por la barbería" }
          : { status: next },
    });
    void refresh();
  }

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold">Turnos</h1>
        <p className="text-sm text-muted">Historial completo de reservas</p>
      </header>

      {/* Filtros */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <FilterInput label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <FilterInput label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent">
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Barbero</label>
          <select value={barberId} onChange={(e) => setBarberId(e.target.value)} className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent">
            <option value="">Todos</option>
            {barbers?.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Buscar</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre o teléfono…"
            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      {loading && <Spinner label="Buscando turnos..." />}
      {!loading && appointments?.length === 0 && (
        <EmptyState title="Sin resultados" hint="Probá ampliar el rango de fechas o quitar filtros." />
      )}

      {/* Tabla */}
      {!loading && appointments && appointments.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2.5">Fecha</th>
                <th className="px-3 py-2.5">Hora</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Cliente</th>
                <th className="px-3 py-2.5">Servicio</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Barbero</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDateShort(a.date)}</td>
                  <td className="px-3 py-2.5 font-bold text-accent">{a.startTime}</td>
                  <td className="hidden max-w-40 truncate px-3 py-2.5 sm:table-cell">
                    {a.customerName}
                    <span className="block text-[11px] text-muted">{a.code}</span>
                  </td>
                  <td className="max-w-36 truncate px-3 py-2.5">
                    {a.serviceName}
                    <span className="block text-[11px] text-muted">{formatMoney(a.servicePrice, settings?.currency)}</span>
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">{a.barberName}</td>
                  <td className="px-3 py-2.5">
                    <Badge status={a.status} label={STATUS_LABEL[a.status]} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      {a.status === "CONFIRMED" && (
                        <>
                          <IconBtn title="Completar" onClick={() => changeStatus(a, "COMPLETED")}>✓</IconBtn>
                          <IconBtn title="Cancelar turno" danger onClick={() => changeStatus(a, "CANCELLED")}>✕</IconBtn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterInput({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted">{label}</label>
      <input {...props} className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent" />
    </div>
  );
}

function IconBtn({
  children,
  danger,
  ...props
}: { children: React.ReactNode; danger?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`h-7 w-7 rounded-lg border border-line text-xs transition hover:bg-surface-2 ${
        danger ? "text-danger hover:border-danger/50" : "text-success"
      }`}
    >
      {children}
    </button>
  );
}
