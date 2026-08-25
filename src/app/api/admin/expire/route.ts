import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { expireOverdueAppointments } from "@/services/appointments.service";

// ═════════════════════════════════════════════════════════
// POST /api/admin/expire — Expira turnos PENDING_PAYMENT vencidos.
// Puede llamarse como cron job o manualmente desde el admin.
// ═════════════════════════════════════════════════════════

export async function POST() {
  return handle(async () => {
    await requireAdmin();
    const count = await expireOverdueAppointments();
    return ok({ expired: count, message: `${count} turnos expirados` });
  });
}
