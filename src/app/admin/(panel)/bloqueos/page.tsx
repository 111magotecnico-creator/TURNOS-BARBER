"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { EmptyState, Spinner } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/client";
import { formatDateShort, minToTime, timeToMin, todayStr } from "@/lib/utils";
import type { BarberDTO } from "@/types";

// ═════════════════════════════════════════════════════════
// BLOQUEOS — excepciones de agenda:
//   • "dayoff": día completo libre (vacaciones, feriado)
//   • "block": franja horaria puntual (almuerzo, corte de pelo propio…)
// El motor de disponibilidad los descuenta antes de ofertar slots.
// ═════════════════════════════════════════════════════════

interface BlockedSlotDTO {
  id: string;
  barberId: string;
  date: string;
  startMin: number;
  endMin: number;
  reason: string | null;
}
interface DayOffDTO {
  id: string;
  barberId: string;
  date: string;
  reason: string | null;
}

export default function BloqueosPage() {
  const [date, setDate] = useState(todayStr());
  const { data: barbers } = useApi<BarberDTO[]>("/api/barbers?all=1");
  const { data: blocksData, loading, refresh } = useApi<{
    blocks: BlockedSlotDTO[];
    daysOff: DayOffDTO[];
  }>(`/api/blocks?date=${date}`);

  const barberName = (id: string) => barbers?.find((b) => b.id === id)?.name ?? "?";

  async function remove(type: "block" | "dayoff", id: string) {
    if (!confirm("¿Eliminar este bloqueo?")) return;
    await apiFetch(`/api/blocks/${id}?type=${type}`, { method: "DELETE" });
    void refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold">Bloqueos</h1>
        <p className="text-sm text-muted">Días libres y franjas bloqueadas</p>
      </header>

      {/* Crear */}
      <BlockForms barbers={barbers ?? []} defaultDate={date} onSaved={refresh} />

      {/* Listado del día */}
      <div className="mt-7">
        <Field label="Ver día">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      {loading && <Spinner label="Cargando..." />}

      {!loading && blocksData?.daysOff.length === 0 && blocksData.blocks.length === 0 && (
        <EmptyState title="Día despejado" hint={`No hay bloqueos para el ${formatDateShort(date)}.`} />
      )}

      {blocksData && blocksData.daysOff.length > 0 && (
        <>
          <h2 className="mb-2.5 mt-5 text-sm font-bold uppercase tracking-wide text-muted">Días libres</h2>
          <ul className="grid gap-2">
            {blocksData.daysOff.map((d) => (
              <ItemRow
                key={d.id}
                icon="🏖"
                title={`${barberName(d.barberId)} · ${formatDateShort(d.date)}`}
                subtitle={d.reason ?? "Día libre"}
                onDelete={() => remove("dayoff", d.id)}
              />
            ))}
          </ul>
        </>
      )}

      {blocksData && blocksData.blocks.length > 0 && (
        <>
          <h2 className="mb-2.5 mt-5 text-sm font-bold uppercase tracking-wide text-muted">Franjas bloqueadas del día</h2>
          <ul className="grid gap-2">
            {blocksData.blocks.map((b) => (
              <ItemRow
                key={b.id}
                icon="🚫"
                title={`${barberName(b.barberId)} · ${minToTime(b.startMin)}–${minToTime(b.endMin)}`}
                subtitle={b.reason ?? "Sin motivo"}
                onDelete={() => remove("block", b.id)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ── Formularios de creación ────────────────────────────────

function BlockForms({
  barbers,
  defaultDate,
  onSaved,
}: {
  barbers: BarberDTO[];
  defaultDate: string;
  onSaved: () => void;
}) {
  const TIME_OPTIONS = buildTimeOptions();
  const [tab, setTab] = useState<"dayoff" | "block">("dayoff");
  const [barberIds, setBarberIds] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("13:00");
  const [end, setEnd] = useState("14:00");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  function toggleBarber(id: string) {
    setBarberIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allSelected = barbers.length > 0 && barberIds.size === barbers.length;

  async function save() {
    setBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      for (const barberId of barberIds) {
        if (tab === "dayoff") {
          await apiFetch("/api/blocks", {
            method: "POST",
            json: { type: "dayoff", barberId, date, reason: reason || undefined },
          });
        } else {
          await apiFetch("/api/blocks", {
            method: "POST",
            json: { type: "block", barberId, date, startMin: timeToMin(start), endMin: timeToMin(end), reason: reason || undefined },
          });
        }
      }
      setOkMsg("Bloqueo creado ✓");
      setReason("");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const valid = barberIds.size > 0 && date && (tab === "dayoff" || timeToMin(start) < timeToMin(end));

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 text-sm font-semibold">
        {(["dayoff", "block"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 transition ${tab === t ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
          >
            {t === "dayoff" ? "🏖 Día libre" : "🚫 Franja horaria"}
          </button>
        ))}
      </div>

      <div className="grid gap-3.5">
        <Field label="Aplica a" required hint={allSelected ? "Toda la barbería" : undefined}>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setBarberIds(allSelected ? new Set() : new Set(barbers.map((b) => b.id)))}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${allSelected ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:text-ink"}`}
            >
              Todos
            </button>
            {barbers.map((b) => (
              <button
                key={b.id}
                onClick={() => toggleBarber(b.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  barberIds.has(b.id) ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:text-ink"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Fecha" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={todayStr()} />
        </Field>

        {tab === "block" && (
          <div className="grid grid-cols-[1fr_16px_1fr] items-end gap-2">
            <Field label="Desde">
              <select value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent">
                {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <span className="pb-3 text-center text-xs text-muted">a</span>
            <Field label="Hasta">
              <select value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent">
                {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
        )}

        <Field label="Motivo">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tab === "dayoff" ? "Ej: Vacaciones" : "Ej: Almuerzo"} maxLength={200} />
        </Field>

        {err && <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        {okMsg && <p className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">{okMsg}</p>}
        <Button onClick={save} loading={busy} disabled={!valid}>Crear bloqueo</Button>
      </div>
    </div>
  );
}

function ItemRow({ icon, title, subtitle, onDelete }: { icon: string; title: string; subtitle?: string; onDelete: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5">
      <span aria-hidden>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      <Button size="sm" variant="danger" onClick={onDelete}>Eliminar</Button>
    </li>
  );
}

function buildTimeOptions(): string[] {
  const opts: string[] = [];
  for (let m = 6 * 60; m <= 23 * 60; m += 15) opts.push(minToTime(m));
  return opts;
}
