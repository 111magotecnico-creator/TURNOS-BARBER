import { prisma } from "@/lib/db";
import { APPOINTMENT_STATUS } from "@/config";
import { addDaysStr, nowLocalParts, todayStr } from "@/lib/utils";
import { getSettings } from "./settings.service";

// ═════════════════════════════════════════════════════════
// Estadísticas del dashboard.
// "Ingresos estimados" = suma de precios de turnos no
// cancelados (CONFIRMED + COMPLETED) del período.
// Escala bien: consultas acotadas por fecha, agregado en JS
// solo sobre el rango visible (una barbería mueve cientos de
// turnos por día, miles como máximo en un mes).
// ═════════════════════════════════════════════════════════

export async function getDashboardStats() {
  const today = todayStr();
  const weekEnd = addDaysStr(today, 6);
  const monthStart = `${today.slice(0, 7)}-01`;
  const now = nowLocalParts();

  const [todayAppointments, monthAgg, settings] = await Promise.all([
    prisma.appointment.findMany({
      where: { date: today },
      include: {
        service: { select: { price: true, name: true } },
        barber: { select: { name: true } },
      },
      orderBy: { startMin: "asc" },
    }),
    prisma.appointment.findMany({
      where: { date: { gte: monthStart } },
      select: { status: true, date: true, service: { select: { price: true } } },
    }),
    getSettings(),
  ]);

  const activeToday = todayAppointments.filter(
    (a) => a.status !== APPOINTMENT_STATUS.CANCELLED
  );

  const upcoming = activeToday
    .filter((a) => a.status === APPOINTMENT_STATUS.CONFIRMED && a.startMin >= now.minutes - 15)
    .slice(0, 6);

  const weekConfirmed = await prisma.appointment.count({
    where: { date: { gte: today, lte: weekEnd }, status: APPOINTMENT_STATUS.CONFIRMED },
  });

  const revenueBetween = (rows: { status: string; service: { price: number } }[]) =>
    rows
      .filter((r) => r.status !== APPOINTMENT_STATUS.CANCELLED)
      .reduce((sum, r) => sum + r.service.price, 0);

  return {
    currency: settings.currency,
    today: {
      total: todayAppointments.length,
      confirmed: todayAppointments.filter((a) => a.status === APPOINTMENT_STATUS.CONFIRMED).length,
      completed: todayAppointments.filter((a) => a.status === APPOINTMENT_STATUS.COMPLETED).length,
      cancelled: todayAppointments.filter((a) => a.status === APPOINTMENT_STATUS.CANCELLED).length,
      estimatedRevenue: revenueBetween(todayAppointments),
    },
    week: { confirmed: weekConfirmed },
    month: {
      cancellations: monthAgg.filter((a) => a.status === APPOINTMENT_STATUS.CANCELLED).length,
      estimatedRevenue: revenueBetween(monthAgg),
    },
    upcoming: upcoming.map((a) => ({
      id: a.id,
      code: a.code,
      time: a.startMin,
      customerName: a.customerName,
      serviceName: a.service.name,
      barberName: a.barber.name,
    })),
  };
}
