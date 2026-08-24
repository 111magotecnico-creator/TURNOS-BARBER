import type { NextRequest } from "next/server";
import { handle, ok, HttpError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { notifyAppointment } from "@/lib/whatsapp";
import { formatDateLong, diffDays, minToTime, nowLocalParts } from "@/lib/utils";
import { getSettings } from "@/services/settings.service";
import { APPOINTMENT_STATUS } from "@/config";

export const dynamic = "force-dynamic";

// ═════════════════════════════════════════════════════════
// CRON DE RECORDATORIOS
//
// POST /api/cron/reminders con header "x-cron-secret".
// Programar con un scheduler externo cada 15 minutos:
//   - Vercel Cron (vercel.json) en producción.
//   - Task Scheduler de Windows / cron en VPS.
//
// Anti-duplicado: los campos reminder24hAt / reminder1hAt del
// turno marcan qué recordatorio ya fue enviado. Se limpian al
// reprogramar. Un fallo de envío NO marca el flag → reintenta.
// ═════════════════════════════════════════════════════════

const WINDOW_24H: [number, number] = [23 * 60, 25 * 60]; // 23h..25h antes
const WINDOW_1H: [number, number] = [45, 75]; // 45..75 min antes

export async function POST(req: NextRequest) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    if (req.headers.get("x-cron-secret") !== secret || !secret) {
      throw new HttpError(401, "No autorizado");
    }

    const settings = await getSettings();
    const now = nowLocalParts();

    const candidates = await prisma.appointment.findMany({
      where: {
        status: APPOINTMENT_STATUS.CONFIRMED,
        date: { in: [now.date] }, // se amplía abajo si hace falta
      },
      include: { barber: true, service: true },
    });
    // Un turno a ~24h puede caer mañana: sumar el día siguiente
    const tomorrowRows = await prisma.appointment.findMany({
      where: {
        status: APPOINTMENT_STATUS.CONFIRMED,
        date: { gt: now.date },
      },
      include: { barber: true, service: true },
    });

    let sent24h = 0;
    let sent1h = 0;

    for (const a of [...candidates, ...tomorrowRows]) {
      const relMin =
        diffDays(now.date, a.date) * 1440 + (a.startMin - now.minutes);

      const data = {
        shopName: settings.shopName,
        customerName: a.customerName,
        customerPhone: a.customerPhone,
        serviceName: a.service.name,
        barberName: a.barber.name,
        dateLong: formatDateLong(a.date),
        time: minToTime(a.startMin),
        manageUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/turno/${a.code}`,
      };

      if (
        !a.reminder24hAt &&
        relMin >= WINDOW_24H[0] &&
        relMin <= WINDOW_24H[1]
      ) {
        await notifyAppointment("reminder24h", data);
        await prisma.appointment.update({
          where: { id: a.id },
          data: { reminder24hAt: new Date() },
        });
        sent24h++;
      }
      if (
        !a.reminder1hAt &&
        relMin >= WINDOW_1H[0] &&
        relMin <= WINDOW_1H[1]
      ) {
        await notifyAppointment("reminder1h", data);
        await prisma.appointment.update({
          where: { id: a.id },
          data: { reminder1hAt: new Date() },
        });
        sent1h++;
      }
    }

    return ok({ sent24h, sent1h, checked: candidates.length + tomorrowRows.length });
  });
}
