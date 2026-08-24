import { z } from "zod";

// ═════════════════════════════════════════════════════════
// Esquemas Zod compartidos: los usa el backend para validar
// cada request Y el frontend para validar formularios.
// Una sola fuente de verdad = cero divergencia de reglas.
// ═════════════════════════════════════════════════════════

export const dateStrSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

export const minuteSchema = z
  .number()
  .int("Minuto inválido")
  .min(0)
  .max(1440);

export const statusSchema = z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]);

// ── Auth ──────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(4, "Contraseña muy corta"),
});

// ── Reserva pública ───────────────────────────────────────────
export const bookingCreateSchema = z.object({
  serviceId: z.string().min(1, "Elegí un servicio"),
  /** id del barbero, o "any"/ausente → asigna automáticamente */
  barberId: z.string().optional(),
  date: dateStrSchema,
  startMin: minuteSchema,
  customerName: z.string().trim().min(2, "Nombre muy corto").max(80),
  customerPhone: z
    .string()
    .trim()
    .min(6, "Teléfono inválido")
    .max(25, "Teléfono inválido"),
  customerEmail: z
    .string()
    .trim()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(300).optional(),
});
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

// ── Gestión por código (cliente sin cuenta) ───────────────────
export const manageCancelSchema = z.object({
  phone: z.string().trim().min(6),
  reason: z.string().trim().max(200).optional(),
});

export const manageRescheduleSchema = z.object({
  phone: z.string().trim().min(6),
  date: dateStrSchema,
  startMin: minuteSchema,
});

// ── Catálogo ──────────────────────────────────────────────────
export const serviceUpsertSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).nullable().optional(),
  price: z.number().int("Precio inválido").min(0).max(100_000_000),
  durationMin: z.number().int().min(5).max(600),
  imageUrl: z
    .string()
    .trim()
    .url("URL de imagen inválida")
    .nullable()
    .optional()
    .or(z.literal("")),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export const barberUpsertSchema = z.object({
  name: z.string().trim().min(2).max(60),
  specialty: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(400).nullable().optional(),
  photoUrl: z
    .string()
    .trim()
    .url("URL inválida")
    .nullable()
    .optional()
    .or(z.literal("")),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

// ── Horarios laborales (reemplazo completo por barbero) ───────
export const workingHoursSchema = z
  .object({
    items: z
      .array(
        z.object({
          weekday: z.number().int().min(0).max(6),
          startMin: minuteSchema,
          endMin: minuteSchema,
          active: z.boolean(),
        })
      )
      .max(60),
  })
  .refine((d) => d.items.every((i) => i.startMin < i.endMin), {
    message: "La hora de inicio debe ser menor a la hora de fin",
  });

// ── Bloqueos y días libres ────────────────────────────────────
export const blockSchema = z
  .object({
    barberId: z.string().min(1),
    date: dateStrSchema,
    startMin: minuteSchema,
    endMin: minuteSchema,
    reason: z.string().trim().max(200).optional(),
  })
  .refine((b) => b.startMin < b.endMin, { message: "Horario inválido" });

export const dayOffSchema = z.object({
  barberId: z.string().min(1),
  date: dateStrSchema,
  reason: z.string().trim().max(200).optional(),
});

// ── Turnos (edición admin) ────────────────────────────────────
export const appointmentUpdateSchema = z.object({
  date: dateStrSchema.optional(),
  startMin: minuteSchema.optional(),
  barberId: z.string().optional(),
  serviceId: z.string().optional(),
  customerName: z.string().trim().min(2).max(80).optional(),
  customerPhone: z.string().trim().min(6).max(25).optional(),
  customerEmail: z
    .string()
    .trim()
    .email("Email inválido")
    .nullable()
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(300).nullable().optional(),
  status: statusSchema.optional(),
  cancelReason: z.string().trim().max(200).optional(),
});

// ── Configuración ─────────────────────────────────────────────
export const settingsUpdateSchema = z.object({
  shopName: z.string().trim().min(2).max(60).optional(),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{8,15}$/, "Código internacional sin '+' ni espacios")
    .optional(),
  instagram: z.string().trim().max(40).nullable().optional(),
  currency: z.enum(["ARS", "USD", "MXN", "CLP", "COP", "BRL", "EUR"]).optional(),
  slotStepMin: z.number().int().min(5).max(120).optional(),
  bookingWindowDays: z.number().int().min(1).max(365).optional(),
  minLeadMin: z.number().int().min(0).max(1440).optional(),
  depositEnabled: z.boolean().optional(),
  depositPercent: z.number().int().min(0).max(100).optional(),
  paymentMode: z.enum(["FULL", "DEPOSIT", "ON_SITE"]).optional(),
});
