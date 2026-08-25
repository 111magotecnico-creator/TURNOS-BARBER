// scripts/expire-pending.cjs
// Expira turnos PENDING_PAYMENT desde la DB directamente.
// Ejecutar: DATABASE_URL="postgres://..." node scripts/expire-pending.cjs
//
// Alternativa al endpoint /api/admin/expire para uso sin servidor.

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  console.log(`[EXPIRE] Checking for overdue PENDING_PAYMENT appointments at ${now.toISOString()}`);

  const result = await prisma.appointment.updateMany({
    where: {
      status: "PENDING_PAYMENT",
      expiresAt: { lt: now },
    },
    data: {
      status: "EXPIRED",
    },
  });

  console.log(`[EXPIRE] Expired ${result.count} appointments`);

  if (result.count > 0) {
    // Log which appointments were expired
    const expired = await prisma.appointment.findMany({
      where: { status: "EXPIRED" },
      orderBy: { updatedAt: "desc" },
      take: result.count,
      select: { code: true, date: true, customerName: true },
    });
    for (const a of expired) {
      console.log(`  - ${a.code} (${a.date}) — ${a.customerName}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("[EXPIRE] Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
