"use client";

import type { Slot } from "@/types";
import { Skeleton } from "@/components/ui/States";

const STATUS = {
  free: "border-line bg-surface text-ink hover:border-accent hover:text-accent",
  selected: "border-accent bg-accent font-bold text-accent-ink",
};

export function TimeSlots({
  slots,
  selectedMinute,
  onSelect,
  loading,
}: {
  slots: Slot[] | undefined;
  selectedMinute: number | null;
  onSelect: (slot: Slot) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-11" />
        ))}
      </div>
    );
  }
  if (!slots || slots.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line py-8 text-center text-sm text-muted">
        Sin horarios disponibles para este día.
        <br />
        Probá con otra fecha 💈
      </p>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {slots.map((s) => (
        <button
          key={s.minute}
          type="button"
          onClick={() => onSelect(s)}
          className={`rounded-xl border px-2 py-3 text-sm transition active:scale-[.97] ${
            s.minute === selectedMinute ? STATUS.selected : STATUS.free
          }`}
        >
          {s.time}
        </button>
      ))}
    </div>
  );
}
