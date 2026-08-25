import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/http";
import { retryPayment } from "@/services/appointments.service";
import { z } from "zod";

// ═════════════════════════════════════════════════════════
// POST /api/payments/retry — Reintenta el pago de un turno PENDING_PAYMENT.
// Crea una nueva preferencia MP y retorna la URL de checkout.
// ═════════════════════════════════════════════════════════

const retrySchema = z.object({
  appointmentCode: z.string().min(1),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = retrySchema.parse(await req.json());
    const result = await retryPayment(body.appointmentCode);
    return ok(result);
  });
}
