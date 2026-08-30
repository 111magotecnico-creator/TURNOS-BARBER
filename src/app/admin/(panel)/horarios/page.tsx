"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/client";
import { minToTime, timeToMin, weekdayName } from "@/lib/utils";
import type { BarberDTO, WorkingHourDTO } from "@/types";

const TIME_OPTIONS: string[] = [];
for (let m = 6 * 60; m <= 23 * 60; m += 15) TIME_OPTIONS.push(minToTime(m));

interface DayRow {
  weekday: number;
  active: boolean;
  start: string;
  end: string;
}

function emptyWeek(): DayRow[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    active: false,
    start: "09:00",
    end: "18:00",
  }));
}

function hydrateFromHours(hours: WorkingHourDTO[]): DayRow[] {
  const next = emptyWeek();
  for (const h of hours) {
    if (!h.active) continue;
    const row = next[h.weekday];
    if (!row) continue;
    row.active = true;
    row.start = minToTime(h.startMin);
    row.end = minToTime(h.endMin);
  }
  return next;
}

export default function HorariosPage() {
  const { data: barbers, loading: loadingBarbers } = useApi<BarberDTO[]>("/api/barbers?all=1");
  const [barberId, setBarberId] = useState<string | null>(null);
  const [rows, setRows] = useState<DayRow[]>(emptyWeek());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const effectiveBarber = barberId ?? barbers?.[0]?.id ?? null;

  const whUrl = effectiveBarber ? `/api/barbers/${effectiveBarber}/working-hours` : null;
  const { data: hours, loading: loadingHours, refresh: refreshHours } = useApi<WorkingHourDTO[]>(whUrl);

  const lastHydratedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!hours || !effectiveBarber) return;
    const key = `${effectiveBarber}:${JSON.stringify(hours)}`;
    if (lastHydratedKey.current === key) return;
    lastHydratedKey.current = key;
    setRows(hydrateFromHours(hours));
  }, [hours, effectiveBarber]);

  useEffect(() => {
    lastHydratedKey.current = null;
  }, [effectiveBarber]);

  function update(weekday: number, patch: Partial<DayRow>) {
    setRows((rs) => rs.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
    setMsg(null);
  }

  async function save() {
    if (!effectiveBarber) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/api/barbers/${effectiveBarber}/working-hours`, {
        method: "PUT",
        json: {
          items: rows
            .filter((r) => r.active)
            .map((r) => ({
              weekday: r.weekday,
              startMin: timeToMin(r.start),
              endMin: timeToMin(r.end),
              active: true,
            })),
        },
      });
      setMsg("Horarios guardados ✓");
      lastHydratedKey.current = null;
      void refreshHours();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const hasActiveDay = useMemo(() => rows.some((r) => r.active), [rows]);

  if (loadingBarbers) return <Spinner label="Cargando..." />;

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold">Horarios laborales</h1>
        <p className="text-sm text-muted">Días y franjas en que cada barbero atiende</p>
      </header>

      <select
        value={effectiveBarber ?? ""}
        onChange={(e) => {
          setBarberId(e.target.value);
          setRows(emptyWeek());
          lastHydratedKey.current = null;
          setMsg(null);
          setErr(null);
        }}
        className="mb-5 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
      >
        {barbers?.map((b) => (
          <option key={b.id} value={b.id}>{b.name}{b.active ? "" : " (inactivo)"}</option>
        ))}
      </select>

      {loadingHours ? (
        <Spinner label="Cargando horarios..." />
      ) : (
        <>
          <ul className="grid gap-2">
            {rows.map((r) => (
              <li key={r.weekday} className={`flex items-center gap-3 rounded-card border p-3.5 transition ${r.active ? "border-line bg-surface" : "border-dashed border-line bg-transparent"}`}>
                <label className="flex w-28 shrink-0 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={(e) => update(r.weekday, { active: e.target.checked })}
                    className="h-4 w-4 accent-[#e8b44a]"
                  />
                  <span className={`text-sm font-semibold ${r.active ? "" : "text-muted"}`}>
                    {weekdayName(r.weekday)}
                  </span>
                </label>
                {r.active ? (
                  <div className="flex flex-1 items-center gap-2">
                    <TimeSelect value={r.start} onChange={(v) => update(r.weekday, { start: v })} />
                    <span className="text-xs text-muted">a</span>
                    <TimeSelect value={r.end} onChange={(v) => update(r.weekday, { end: v })} />
                  </div>
                ) : (
                  <span className="flex-1 text-sm text-muted">No trabaja</span>
                )}
              </li>
            ))}
          </ul>

          {err && <p className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
          {msg && <p className="mt-4 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">{msg}</p>}

          <div className="mt-5 flex justify-end">
            <Button onClick={save} loading={busy} disabled={!hasActiveDay}>
              Guardar horarios
            </Button>
          </div>
          {!hasActiveDay && (
            <p className="mt-2 text-right text-xs text-muted">
              Activá al menos un día para poder guardar.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 rounded-xl border border-line bg-surface-2 px-2 py-2 text-sm outline-none focus:border-accent"
    >
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}
