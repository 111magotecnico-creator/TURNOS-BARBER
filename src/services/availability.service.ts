import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { computeSlots } from "@/lib/availability/engine";
import type { BarberDayInput } from "@/types";
import { getSettings } from "@/services/settings.service";
import {
  diffDays,
  getWeekday,
  isValidDateStr,
  nowLocalParts,
  todayStr,
} from "@/lib/utils";
import { BLOCKING_STATUSES } from "@/config";

// ═════════════════════════════════════════════════════════
// SERVICIO DE DISPONIBILIDAD
//
// Consulta la DB (horarios laborales, días libres, bloqueos,
// turnos confirmados) y alimenta el motor PURO computeSlots().
// La separación motor/servicio permite testear el algoritmo
// sin base de datos y reutilizarlo en varios contextos.
// ═════════════════════════════════════════════════════════

export interface AvailabilityQuery {
  serviceId: string;
  date: string;
  /** id del barbero o "any" (todos los activos) */
  barberId?: string;
}

export interface AvailabilityResult {
  date: string;
  durationMin: number;
  slotStepMin: number;
  slots: ReturnType<typeof computeSlots>;
}

export async function getAvailability(
  q: AvailabilityQuery
): Promise<AvailabilityResult> {
  if (!isValidDateStr(q.date)) throw new HttpError(400, "Fecha inválida");

  const settings = await getSettings();
  const ahead = diffDays(todayStr(), q.date);
  if (ahead < 0) throw new HttpError(400, "No hay disponibilidad en fechas pasadas");
  if (ahead > settings.bookingWindowDays) {
    throw new HttpError(
      400,
      `Solo se puede reservar con hasta ${settings.bookingWindowDays} días de anticipación`
    );
  }

  const service = await prisma.service.findUnique({
    where: { id: q.serviceId },
  });
  if (!service || !service.active) throw new HttpError(404, "Servicio no disponible");

  let barbers = await prisma.barber.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });

  const specific = q.barberId && q.barberId !== "any";
  if (specific) barbers = barbers.filter((b) => b.id === q.barberId);

  const ids = barbers.map((b) => b.id);
  if (ids.length === 0) {
    return {
      date: q.date,
      durationMin: service.durationMin,
      slotStepMin: settings.slotStepMin,
      slots: [],
    };
  }

  const weekday = getWeekday(q.date);
  const [hours, offs, blocked, busy] = await Promise.all([
    prisma.workingHour.findMany({
      where: { barberId: { in: ids }, weekday, active: true },
      orderBy: { startMin: "asc" },
    }),
    prisma.dayOff.findMany({ where: { barberId: { in: ids }, date: q.date } }),
    prisma.blockedSlot.findMany({
      where: { barberId: { in: ids }, date: q.date },
    }),
    prisma.appointment.findMany({
      where: { barberId: { in: ids }, date: q.date, status: { in: BLOCKING_STATUSES } },
      select: { barberId: true, startMin: true, endMin: true },
    }),
  ]);

  const inputs: BarberDayInput[] = barbers.map((b) => ({
    barberId: b.id,
    workingIntervals: hours
      .filter((h) => h.barberId === b.id)
      .map((h) => ({ start: h.startMin, end: h.endMin })),
    busy: busy
      .filter((a) => a.barberId === b.id)
      .map((a) => ({ start: a.startMin, end: a.endMin })),
    blocked: blocked
      .filter((x) => x.barberId === b.id)
      .map((x) => ({ start: x.startMin, end: x.endMin })),
    isDayOff: offs.some((o) => o.barberId === b.id),
  }));

  // Si es HOY: no ofrecer horarios anteriores a ahora + anticipación mínima
  const now = nowLocalParts();
  const minStart = ahead === 0 ? now.minutes + settings.minLeadMin : 0;

  const slots = computeSlots({
    barbers: inputs,
    durationMin: service.durationMin,
    slotStepMin: settings.slotStepMin,
    minStart,
  });

  return {
    date: q.date,
    durationMin: service.durationMin,
    slotStepMin: settings.slotStepMin,
    slots,
  };
}
