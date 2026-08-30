const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const barberId = 'cmt7map3t00018ya8d37ud2az'; // Martin
  const items = [
    { weekday: 0, startMin: 540, endMin: 1080, active: true },
    { weekday: 2, startMin: 540, endMin: 1080, active: true },
  ];

  console.log('Before:', await prisma.workingHour.findMany({ where: { barberId } }));

  await prisma.$transaction([
    prisma.workingHour.deleteMany({ where: { barberId } }),
    prisma.workingHour.createMany({
      data: items.map((i) => ({ ...i, barberId })),
    }),
  ]);

  console.log('After:', await prisma.workingHour.findMany({ where: { barberId } }));
  await prisma.$disconnect();
})();
