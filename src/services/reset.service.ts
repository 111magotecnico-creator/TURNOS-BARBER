import { prisma } from "@/lib/db";

// ═════════════════════════════════════════════════════════
// REINICIAR AGENDA — pone todos los turnos a cero
// conservando barberos, servicios, horarios, bloqueos,
// configuración y usuario admin.
//
// Borrado seguro: Payments → Appointments → Customers.
// Todo dentro de una transacción; si algo falla, rollback.
// ═════════════════════════════════════════════════════════

export interface ResetResult {
  payments: number;
  appointments: number;
  customers: number;
}

export async function resetAgenda(): Promise<ResetResult> {
  return prisma.$transaction(async (tx) => {
    // 1) Borrar pagos (FK requiere que exista appointment)
    const payments = await tx.payment.deleteMany();

    // 2) Borrar turnos
    const appointments = await tx.appointment.deleteMany();

    // 3) Borrar clientes huérfanos (solo los que ya no tienen turnos)
    //    Customer se crea automáticamente por reserva; tras borrar
    //    todos los turnos, quedan huérfanos y se limpian.
    const customers = await tx.customer.deleteMany();

    console.log(
      `[RESET] Agenda reiniciada: ${payments.count} pagos, ${appointments.count} turnos, ${customers.count} clientes eliminados.`
    );

    return {
      payments: payments.count,
      appointments: appointments.count,
      customers: customers.count,
    };
  });
}

/** Cuenta turnos activos (para mostrar en UI antes del reset). */
export async function countActiveAppointments(): Promise<number> {
  return prisma.appointment.count();
}
