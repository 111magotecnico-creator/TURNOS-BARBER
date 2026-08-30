import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { todayStr } from "@/lib/utils";
import { BLOCKING_STATUSES } from "@/config";

// ═════════════════════════════════════════════════════════
// CRUD de barberos + gestión de horarios laborales.
//
// replaceWorkingHours() guarda la semana completa de un
// barbero en una transacción (borra y recrea): atómico,
// simple y a prueba de estados intermedios inválidos.
// ═════════════════════════════════════════════════════════

export interface BarberData {
  name: string;
  specialty?: string | null;
  description?: string | null;
  photoUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
}

export interface WorkingHourItem {
  weekday: number; // 0=Lunes ... 6=Domingo
  startMin: number;
  endMin: number;
  active: boolean;
}

export function listBarbers(includeInactive = false) {
  return prisma.barber.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getBarberDetail(id: string) {
  const b = await prisma.barber.findUnique({
    where: { id },
    include: {
      workingHour: {
        orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
      },
    },
  });
  if (!b) throw new HttpError(404, "Barbero no encontrado");
  return b;
}

async function ensureExists(id: string) {
  const b = await prisma.barber.findUnique({ where: { id } });
  if (!b) throw new HttpError(404, "Barbero no encontrado");
  return b;
}

export async function createBarber(data: BarberData) {
  const max = await prisma.barber.aggregate({ _max: { sortOrder: true } });
  return prisma.barber.create({
    data: { ...data, sortOrder: data.sortOrder ?? (max._max.sortOrder ?? -1) + 1 },
  });
}

export async function updateBarber(id: string, data: Partial<BarberData>) {
  await ensureExists(id);
  return prisma.barber.update({ where: { id }, data });
}

export async function deleteBarber(id: string) {
  await ensureExists(id);
  // ¿Tiene turnos confirmados a futuro? → baja lógica (protege agenda)
  const future = await prisma.appointment.count({
    where: {
      barberId: id,
      status: { in: BLOCKING_STATUSES },
      date: { gte: todayStr() },
    },
  });
  if (future > 0) {
    await prisma.barber.update({ where: { id }, data: { active: false } });
    return { softDeleted: true };
  }
  // Sin turnos futuros → borrado físico (cascade limpia horarios/bloqueos).
  // Los turnos históricos usan onDelete por FK: Prisma los exige restringidos,
  // así que solo borramos si no tiene NINGÚN turno.
  const any = await prisma.appointment.count({ where: { barberId: id } });
  if (any > 0) {
    await prisma.barber.update({ where: { id }, data: { active: false } });
    return { softDeleted: true };
  }
  await prisma.barber.delete({ where: { id } });
  return { softDeleted: false };
}

/** Obtiene los horarios laborales de un barbero. */
export async function getBarberWorkingHours(barberId: string) {
  await ensureExists(barberId);
  return prisma.workingHour.findMany({
    where: { barberId },
    orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
  });
}

/** Reemplaza TODA la configuración semanal de horarios del barbero. */
export async function replaceWorkingHours(
  barberId: string,
  items: WorkingHourItem[]
) {
  await ensureExists(barberId);
  await prisma.$transaction([
    prisma.workingHour.deleteMany({ where: { barberId } }),
    ...(items.length
      ? [
          prisma.workingHour.createMany({
            data: items.map((i) => ({ ...i, barberId })),
          }),
        ]
      : []),
  ]);
  return getBarberDetail(barberId);
}
