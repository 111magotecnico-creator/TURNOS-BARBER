import { HttpError } from "@/lib/http";

// ═════════════════════════════════════════════════════════
// ARQUITECTURA DE PAGOS — MercadoPago Checkout Pro
//
// Flujo completo:
//   1. Backend crea PENDING_PAYMENT + preferencia MP.
//   2. Cliente paga en Checkout Pro.
//   3. MP redirige a back_urls (success/failure/pending).
//   4. Webhook recibe notificación IPN → verifica pago → confirma turno.
//
// Seguridad: Access Token NUNCA se expone al frontend.
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

export function getMercadoPagoPublicKey(): string {
  return process.env.MERCADOPAGO_PUBLIC_KEY ?? "";
}

/**
 * Calcula el monto a cobrar según la configuración de la barbería.
 * Si el servicio tiene depositPercent propio, usa ese; si no, el general.
 */
export function resolveAmount(
  mode: string,
  price: number,
  depositPercent: number,
  serviceDepositPercent?: number | null
): number {
  if (mode === "DEPOSIT") {
    const pct = serviceDepositPercent ?? depositPercent;
    return Math.max(1, Math.round((price * pct) / 100));
  }
  return price; // FULL u ON_SITE (ON_SITE no cobra online)
}

/**
 * Resuelve el porcentaje efectivo de seña para un servicio.
 */
export function resolveDepositPercent(
  serviceDepositPercent?: number | null,
  generalDepositPercent?: number
): number {
  return serviceDepositPercent ?? generalDepositPercent ?? 0;
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
        back_urls: {
          success: `${appUrl}/api/payments/success`,
          failure: `${appUrl}/api/payments/failure`,
          pending: `${appUrl}/api/payments/pending`,
        },
        auto_return: "approved",
        notification_url: `${appUrl}/api/payments/webhook`,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error("[MP] Preference creation error:", res.status, body);
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

/**
 * Verifica un pago consultando la API de MercadoPago.
 * Retorna los datos verificados del pago.
 */
export async function verifyMercadoPagoPayment(paymentId: string): Promise<{
  id: number;
  status: string;
  transaction_amount: number;
  currency_id: string;
  external_reference?: string;
  metadata?: Record<string, unknown>;
  payment_method_id?: string;
  date_approved?: string;
}> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new HttpError(503, "Pagos no configurados");
  }

  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    throw new HttpError(502, `Error consultando pago MP: ${res.status}`);
  }

  return res.json();
}
