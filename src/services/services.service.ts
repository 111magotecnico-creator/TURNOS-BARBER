import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/db";

// ═════════════════════════════════════════════════════════
// CRUD de servicios del catálogo.
//
// deleteService() aplica "baja lógica si tiene historial":
// si un servicio ya tiene turnos asociados, NO se borra
// (rompería turnos pasados) sino que se desactiva.
// ═════════════════════════════════════════════════════════

export interface ServiceData {
  name: string;
  description?: string | null;
  price: number;
  durationMin: number;
  imageUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
}

export function listServices(includeInactive = false) {
  return prisma.service.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getService(id: string) {
  const s = await prisma.service.findUnique({ where: { id } });
  if (!s) throw new HttpError(404, "Servicio no encontrado");
  return s;
}

export async function createService(data: ServiceData) {
  return prisma.service.create({ data });
}

export async function updateService(id: string, data: Partial<ServiceData>) {
  await getService(id);
  return prisma.service.update({ where: { id }, data });
}

export async function deleteService(id: string) {
  await getService(id);
  const appointments = await prisma.appointment.count({
    where: { serviceId: id },
  });
  if (appointments > 0) {
    await prisma.service.update({ where: { id }, data: { active: false } });
    return { softDeleted: true };
  }
  await prisma.service.delete({ where: { id } });
  return { softDeleted: false };
}
