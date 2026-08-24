import type { BarberDayInput, Slot, SlotInput } from "@/types";
import { minToTime, overlaps } from "@/lib/utils";

// ═════════════════════════════════════════════════════════
// MOTOR DE DISPONIBILIDAD
//
// Función PURA: recibe datos ya consultados de la DB y calcula
// los horarios realmente disponibles. No toca la base de datos,
// lo que lo hace trivial de testear y reutilizable (API pública,
// panel admin, "cualquier barbero", etc).
//
// Algoritmo por barbero:
//   1. Si es día libre → sin horarios.
//   2. Para cada jornada laboral del día [ws, we):
//        candidatos t = ws, ws+step, ws+2*step...
//        un candidato es válido si:
//          - el servicio entra completo: t + duración <= we
//          - no se superpone con turnos existentes (CONFIRMED)
//          - no se superpone con bloqueos manuales
//          - t >= minStart (hora actual + anticipación mínima)
//   3. Se agregan los resultados por minuto y se combinan todos
//      los barberos (para soportar "Cualquier barbero").
//
// Los turnos CANCELLED nunca llegan acá: el servicio que consulta
// la DB solo pasa turnos CONFIRMED como busy.
// ═════════════════════════════════════════════════════════

export function computeSlots(input: SlotInput): Slot[] {
  const { barbers, durationMin, slotStepMin } = input;
  const minStart = input.minStart ?? 0;

  if (durationMin <= 0 || slotStepMin <= 0) return [];

  // minute -> set de barberos libres en ese minuto
  const byMinute = new Map<number, Set<string>>();

  for (const barber of barbers) {
    if (barber.isDayOff) continue;

    for (const wh of barber.workingIntervals) {
      if (wh.end <= wh.start) continue; // jornada inválida

      for (
        let t = alignToStep(wh.start, slotStepMin);
        t + durationMin <= wh.end;
        t += slotStepMin
      ) {
        if (t < minStart) continue;

        if (conflicts(t, t + durationMin, barber.busy)) continue;
        if (conflicts(t, t + durationMin, barber.blocked)) continue;

        let free = byMinute.get(t);
        if (!free) {
          free = new Set<string>();
          byMinute.set(t, free);
        }
        free.add(barber.barberId);
      }
    }
  }

  return [...byMinute.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([minute, ids]) => ({
      minute,
      time: minToTime(minute),
      barberIds: [...ids],
    }));
}

/** Alinea el inicio de jornada al múltiplo del step (ej: 09:05 → 09:15). */
function alignToStep(start: number, step: number): number {
  return Math.ceil(start / step) * step;
}

function conflicts(
  start: number,
  end: number,
  intervals: Interval[],
): boolean {
  return intervals.some((iv) =>
    overlaps(start, end, iv.start, iv.end),
  );
}

type Interval = BarberDayInput["busy"][number];

/**
 * Dado un conjunto de slots (resultado de computeSlots), devuelve los
 * minutos donde hay al menos `count` barberos disponibles.
 */
export function filterSlotsWithCapacity(slots: Slot[], count = 1): Slot[] {
  return slots.filter((s) => s.barberIds.length >= count);
}
