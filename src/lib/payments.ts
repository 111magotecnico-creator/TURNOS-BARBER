import { HttpError } from "@/lib/http";

// ═════════════════════════════════════════════════════════
// ARQUITECTURA DE PAGOS (Mercado Pago)
//
// Preparada pero NO activada: si no existe
// MERCADOPAGO_ACCESS_TOKEN en .env, los endpoints de pago
// responden 503 con un mensaje claro. Nunca se simula un pago.
//
// Flujo previsto cuando se active:
//   1. POST /api/appointments crea el turno (modo ON_SITE hoy).
//   2. Si Settings.paymentMode = FULL | DEPOSIT y MP configurado,
//      se genera preferencia → cliente paga → webhook confirma
//      → Payment.status = APPROVED (endpoint /api/payments/webhook,
//      a implementar junto con las credenciales reales).
// ═════════════════════════════════════════════════════════

export interface PaymentPreferenceInput {
  appointmentCode: string;
  title: string;
  unitPrice: number;
  currency: string;
  payerEmail?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PaymentPreference {
  id: string;
  initPoint: string;
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

/**
 * Calcula el monto a cobrar según la configuración de la barbería.
 */
export function resolveAmount(
  mode: string,
  price: number,
  depositPercent: number
): number {
  if (mode === "DEPOSIT") {
    return Math.max(1, Math.round((price * depositPercent) / 100));
  }
  return price; // FULL u ON_SITE (ON_SITE no cobra online)
}

export async function createMercadoPagoPreference(
  input: PaymentPreferenceInput
): Promise<PaymentPreference> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new HttpError(
      503,
      "Pagos no configurados: falta MERCADOPAGO_ACCESS_TOKEN"
    );
  }

  const res = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: input.title,
            quantity: 1,
            unit_price: input.unitPrice,
            currency_id: input.currency,
          },
        ],
        external_reference: input.appointmentCode || undefined,
        metadata: input.metadata ?? undefined,
        payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      }),
    }
  );

  if (!res.ok) {
    throw new HttpError(502, `Mercado Pago respondió con error ${res.status}`);
  }

  const json = (await res.json()) as {
    id: string;
    init_point?: string;
    sandbox_init_point?: string;
  };
  return {
    id: json.id,
    initPoint: json.init_point ?? json.sandbox_init_point ?? "",
  };
}
