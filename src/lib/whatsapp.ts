// ═════════════════════════════════════════════════════════
// ADAPTER DE WHATSAPP
//
// Estado actual (sin credenciales):
//   - Genera plantillas de mensajes listas para enviar.
//   - Los "envíos" se registran por consola (visible en dev).
//
// Cuando la barbería contrate WhatsApp Business Cloud API:
//   - Cargar WHATSAPP_TOKEN y WHATSAPP_PHONE_ID en .env.
//   - El MISMO adapter pasa a enviar mensajes reales vía
//     Meta Graph API. Cero cambios en el resto del sistema.
//
// Regla de oro: un fallo de WhatsApp NUNCA rompe una reserva.
// ═════════════════════════════════════════════════════════

import { formatMoney } from "@/lib/utils";

interface WhatsAppSender {
  readonly provider: string;
  send(to: string, text: string): Promise<void>;
}

class ConsoleSender implements WhatsAppSender {
  readonly provider = "console";
  async send(to: string, text: string): Promise<void> {
    console.log(`[WHATSAPP → ${to}]\n${text}`);
  }
}

class MetaCloudSender implements WhatsAppSender {
  readonly provider = "meta-cloud-api";
  constructor(
    private phoneId: string,
    private token: string
  ) {}
  async send(to: string, text: string): Promise<void> {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${this.phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
    }
  }
}

let cachedSender: WhatsAppSender | null = null;

function getSender(): WhatsAppSender {
  if (!cachedSender) {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    cachedSender =
      token && phoneId ? new MetaCloudSender(phoneId, token) : new ConsoleSender();
  }
  return cachedSender;
}

export function whatsappProvider(): string {
  return getSender().provider;
}

// ── Datos comunes de los mensajes ─────────────────────────────
export interface AppointmentMessageData {
  shopName: string;
  customerName: string;
  customerPhone: string; // internacional normalizado sin "+"
  serviceName: string;
  barberName: string;
  dateLong: string; // "lunes 12 de mayo"
  time: string; // "15:30"
  price?: number;
  currency?: string;
  manageUrl?: string;
  depositAmount?: number;
  remainingBalance?: number;
}

export type NotificationKind =
  | "pending"
  | "confirmed"
  | "reminder24h"
  | "reminder1h"
  | "cancelled"
  | "rescheduled";

function buildMessage(
  kind: NotificationKind,
  d: AppointmentMessageData
): string {
  switch (kind) {
    case "pending":
      return [
        `Hola ${d.customerName} 👋`,
        ``,
        `Tu turno en ${d.shopName} quedó registrado.`,
        ``,
        `✂️ Servicio: ${d.serviceName}`,
        `💈 Barbero: ${d.barberName}`,
        `📅 Fecha: ${d.dateLong}`,
        `⏰ Hora: ${d.time}`,
        ...(d.price
          ? [`💰 Seña a abonar: ${formatMoney(d.price, d.currency)}`]
          : []),
        ...(d.manageUrl ? [``, `Gestioná tu turno: ${d.manageUrl}`] : []),
        ``,
        `Para confirmarlo, aboná la seña online.`,
      ].join("\n");
    case "confirmed":
      return [
        `Hola ${d.customerName} 👋`,
        ``,
        `Tu turno en ${d.shopName} quedó confirmado.`,
        ``,
        `✂️ Servicio: ${d.serviceName}`,
        `💈 Barbero: ${d.barberName}`,
        `📅 Fecha: ${d.dateLong}`,
        `⏰ Hora: ${d.time}`,
        ...(d.price
          ? [`💰 Precio total: ${formatMoney(d.price, d.currency)}`]
          : []),
        ...(d.depositAmount
          ? [`✅ Seña abonada: ${formatMoney(d.depositAmount, d.currency)}`]
          : []),
        ...(d.remainingBalance
          ? [`💳 Saldo: ${formatMoney(d.remainingBalance, d.currency)}`]
          : []),
        ...(d.manageUrl ? [``, `Gestioná tu turno: ${d.manageUrl}`] : []),
        ``,
        `¡Te esperamos!`,
      ].join("\n");
    case "reminder24h":
      return [
        `Hola ${d.customerName} 👋 Te recordamos tu turno de mañana en ${d.shopName}.`,
        ``,
        `✂️ ${d.serviceName} con ${d.barberName}`,
        `⏰ ${d.time}`,
        ``,
        `¿No podés venir? Cancelá o reprogramá acá: ${d.manageUrl ?? "-"}`,
      ].join("\n");
    case "reminder1h":
      return [
        `Hola ${d.customerName}! Tu turno es en 1 hora ⏰`,
        ``,
        `${d.serviceName} con ${d.barberName} · ${d.time}`,
        `Te esperamos en ${d.shopName}.`,
      ].join("\n");
    case "cancelled":
      return `Hola ${d.customerName}, tu turno del ${d.dateLong} a las ${d.time} en ${d.shopName} fue cancelado. Reservá de nuevo cuando quieras 💈`;
    case "rescheduled":
      return [
        `Hola ${d.customerName} 👋 Tu turno fue reprogramado.`,
        ``,
        `📅 Nueva fecha: ${d.dateLong}`,
        `⏰ Nueva hora: ${d.time}`,
        `✂️ ${d.serviceName} con ${d.barberName}`,
        ``,
        `¡Te esperamos!`,
      ].join("\n");
  }
}

/** Envío a prueba de fallos: loguea el error, no propaga excepciones. */
export async function notifyAppointment(
  kind: NotificationKind,
  d: AppointmentMessageData
): Promise<void> {
  try {
    await getSender().send(d.customerPhone, buildMessage(kind, d));
  } catch (err) {
    console.error("[WHATSAPP] Fallo al notificar (no bloquea):", err);
  }
}

/** Link directo al chat (botón "Contactar por WhatsApp" del frontend). */
export function waMeLink(phoneIntl: string, text?: string): string {
  const base = `https://wa.me/${phoneIntl.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
