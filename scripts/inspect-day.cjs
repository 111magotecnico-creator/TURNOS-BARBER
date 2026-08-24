const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const date = "2026-08-24";
  const appts = await p.appointment.findMany({ where: { date }, orderBy: { startMin: "asc" } });
  console.log("TURNOS", date);
  for (const a of appts) {
    console.log(" ", String(a.startMin).padStart(4), "-", a.endMin, a.status.padEnd(9), a.customerName.padEnd(18), "code", a.code);
  }
  const wdOfDate = (new Date(2026, 7, 24, 12).getDay() + 6) % 7;
  console.log("weekday de la fecha:", wdOfDate);
  const wh = await p.workingHour.findMany({
    where: { active: true, weekday: wdOfDate },
    include: { barber: true },
    orderBy: [{ barberId: "asc" }],
  });
  console.log("HORARIOS ACTIVOS ESE DIA:");
  for (const w of wh) console.log(" ", w.barber.name.padEnd(8), w.startMin, "-", w.endMin);
  console.log("DAYOFFS:", JSON.stringify(await p.dayOff.findMany()));
  console.log("BLOCKS:", JSON.stringify(await p.blockedSlot.findMany()));
  await p.$disconnect();
})();
