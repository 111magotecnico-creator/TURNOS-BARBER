import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await ctx.params;

    const appt = await prisma.appointment.findUnique({
      where: { code: code.toUpperCase() },
      include: { service: true, barber: true },
    });

    if (!appt) {
      return new NextResponse("Turno no encontrado", { status: 404 });
    }

    const settings = await prisma.settings.findFirst();
    const shopName = settings?.shopName ?? "Barberia";

    const d = appt.date.replace(/-/g, "");
    const startH = pad2(Math.floor(appt.startMin / 60));
    const startM = pad2(appt.startMin % 60);
    const endH = pad2(Math.floor(appt.endMin / 60));
    const endM = pad2(appt.endMin % 60);

    const barberName = appt.barber?.name ?? "Barbero asignado";
    const serviceName = appt.service?.name ?? "Turno";

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//" + shopName + "//Turno//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `DTSTART:${d}T${startH}${startM}00`,
      `DTEND:${d}T${endH}${endM}00`,
      `SUMMARY:${serviceName} - ${shopName}`,
      `DESCRIPTION:Barbero: ${barberName}. Codigo: ${appt.code}`,
      `LOCATION:${settings?.address ?? ""}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="turno-${appt.code}.ics"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    return new NextResponse("Error", { status: 500 });
  }
}
