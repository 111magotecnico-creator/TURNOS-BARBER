// Purga única: cancela turnos de prueba CONFIRMED dejados por corridas
// anteriores del smoke suite y repros (nunca toca datos reales).
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
const TEST_NAMES = [
  "Pedro Prueba",
  "Ana Lopez",
  "Atacante Malicioso",
  "Repro Test",
  "Debug Test",
];
(async () => {
  const r = await p.appointment.updateMany({
    where: { status: "CONFIRMED", customerName: { in: TEST_NAMES } },
    data: {
      status: "CANCELLED",
      cancelReason: "Purga de datos de prueba",
    },
  });
  console.log(`Cancelados ${r.count} turnos de prueba.`);
  const left = await p.appointment.count({
    where: { status: "CONFIRMED", customerName: { in: TEST_NAMES } },
  });
  console.log(`Quedan CONFIRMED de prueba: ${left}`);
  await p.$disconnect();
})();
