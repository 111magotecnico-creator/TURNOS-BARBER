// ═════════════════════════════════════════════════════════
// db:reset — script de desarrollo para limpiar la agenda.
//
// Uso: npm run db:reset
//
// Elimina turnos, pagos y clientes. Conserva todo lo demás
// (barberos, servicios, horarios, configuración, admin).
// ═════════════════════════════════════════════════════════

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  console.log("Reiniciando agenda...");

  const [payments, appointments, customers] = await p.$transaction([
    p.payment.deleteMany(),
    p.appointment.deleteMany(),
    p.customer.deleteMany(),
  ]);

  console.log(`✓ Pagos eliminados:     ${payments.count}`);
  console.log(`✓ Turnos eliminados:    ${appointments.count}`);
  console.log(`✓ Clientes eliminados:  ${customers.count}`);
  console.log("\nAgenda vacía. Barbería lista para recibir reservas.");

  await p.$disconnect();
})();
