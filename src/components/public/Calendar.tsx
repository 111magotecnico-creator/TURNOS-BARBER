"use client";

import { useMemo, useState } from "react";
import {
  addDaysStr,
  fromDateStr,
  todayStr,
} from "@/lib/utils";

// ═════════════════════════════════════════════════════════
// Calendario mensual propio (sin dependencias).
// - Deshabilita pasado y días fuera de la ventana de reserva.
// - Navegación mes actual + siguiente (límite bookingWindowDays).
// ═════════════════════════════════════════════════════════

const WEEK_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function Calendar({
  value,
  onChange,
  maxDaysAhead,
}: {
  value: string | null;
  onChange: (dateStr: string) => void;
  maxDaysAhead: number;
}) {
  const today = todayStr();
  const lastValid = addDaysStr(today, maxDaysAhead);

  // Mes mostrado (empieza en el mes del valor/hoy)
  const initial = useMemo(() => {
    const base = fromDateStr(value ?? today);
    return { y: base.getFullYear(), m: base.getMonth() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [view, setView] = useState(initial);

  const grid = useMemo(() => {
    const first = new Date(view.y, view.m, 1, 12);
    const startOffset = (first.getDay() + 6) % 7; // lunes=0
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const cells: (string | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(
        `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      );
    }
    return cells;
  }, [view]);

  const canPrev =
    view.y > fromDateStr(today).getFullYear() ||
    (view.y === fromDateStr(today).getFullYear() &&
      view.m > fromDateStr(today).getMonth());
  const canNext = `${lastValid.slice(0, 7)}` >=
    `${view.y}-${String(view.m + 1).padStart(2, "0")}`;

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={!canPrev}
          aria-label="Mes anterior"
          className="rounded-lg px-2.5 py-1.5 text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-30"
        >
          ‹
        </button>
        <p className="text-sm font-bold">
          {MONTHS[view.m]} {view.y}
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={!canNext}
          aria-label="Mes siguiente"
          className="rounded-lg px-2.5 py-1.5 text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK_LABELS.map((l) => (
          <span key={l} className="py-1 text-[11px] font-semibold text-muted">
            {l}
          </span>
        ))}
        {grid.map((d, i) => {
          if (!d) return <span key={`x${i}`} />;
          const disabled = d < today || d > lastValid;
          const selected = d === value;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => onChange(d)}
              className={`aspect-square rounded-lg text-sm font-medium transition ${
                selected
                  ? "bg-accent font-bold text-accent-ink"
                  : disabled
                    ? "text-muted/30"
                    : "hover:bg-surface-2"
              } ${isToday && !selected ? "border border-accent/50" : ""}`}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
