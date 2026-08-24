import { prisma } from "@/lib/db";

// ═════════════════════════════════════════════════════════
// Configuración de la barbería (fila única id="default").
// getSettings() auto-crea la fila si no existe → el sistema
// funciona incluso con base vacía.
// ═════════════════════════════════════════════════════════

export async function getSettings() {
  let s = await prisma.settings.findUnique({ where: { id: "default" } });
  if (!s) {
    s = await prisma.settings.create({
      data: { id: "default", shopName: "BARBERS", whatsapp: "" },
    });
  }
  return s;
}

export async function updateSettings(
  data: Partial<{
    shopName: string;
    address: string;
    phone: string;
    whatsapp: string;
    instagram: string | null;
    currency: string;
    slotStepMin: number;
    bookingWindowDays: number;
    minLeadMin: number;
    depositEnabled: boolean;
    depositPercent: number;
    paymentMode: string;
  }>
) {
  await getSettings();
  return prisma.settings.update({ where: { id: "default" }, data });
}
