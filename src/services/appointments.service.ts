import type {
  Barber,
  Prisma,
  PrismaClient,
  Service,
} from "@prisma/client";
import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { APPOINTMENT_STATUS, BLOCKING_STATUSES } from "@/config";
import {
  diffDays,
  formatDateLong,
  formatMoney,
  generateCode,
  getWeekday,
  minToTime,
  normalizePhone,
  nowLocalParts,
  todayStr,
} from "@/lib/utils";
import { notifyAppointment } from "@/lib/whatsapp";
import { getSettings } from "./settings.service";
import {
  isMercadoPagoConfigured,
  createMercadoPagoPreference,
  resolveAmount,
} from "@/lib/payments";

// ═════════════════════════════════════════════════════════
// SERVICIO DE TURNOS — núcleo del sistema.
//
// ANTI-DOBLE-RESERVA (defensa en profundidad):
//   Capa 1: el motor de disponibilidad nunca ofrece slots ocupados.
//   Capa 2: TODA escritura pasa por una transacción que vuelve a
//           verificar solapamiento contra la DB justo antes de insertar.
//   Capa 3: (PostgreSQL) isolation Serializable; con SQLite los writes
//           ya son serializados por el motor.
//
// REGLA: la validación vive acá (servidor), nunca solo en el cliente.
// ═════════════════════════════════════════════════════════

type Db = Prisma.TransactionClient | PrismaClient;

const IS_PG = (process.env.DATABASE_URL ?? "").startsWith("postgres");
const TX_OPTS = IS_PG
  ? ({ isolationLevel: "Serializable" as const })
  : undefined;

const fullInclude = { barber: true, service: true } as const;
export type AppointmentFull = Prisma.AppointmentGetPayload<{
  include: typeof fullInclude;
}>;

interface SlotKey {
  barberId: string;
  date: string;
  startMin: number;
  endMin: number;
}

/** ¿Existe turno confirmado o bloqueo que se superponga? */
async function conflictsExist(
  db: Db,
  p: SlotKey,
  excludeId?: string
): Promise<boolean> {
  const [busy, blocked] = await Promise.all([
    db.appointment.count({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        barberId: p.barberId,
        date: p.date,
        status: { in: BLOCKING_STATUSES },
        startMin: { lt: p.endMin },
        endMin: { gt: p.startMin },
      },
    }),
    db.blockedSlot.count({
      where: {
        barberId: p.barberId,
        date: p.date,
        startMin: { lt: p.endMin },
        endMin: { gt: p.startMin },
      },
    }),
  ]);
  return busy > 0 || blocked > 0;
}

/**
 * Valida que un slot sea reservable para UN barbero específico.
 * Lanza HttpError con mensaje claro si algo falla.
 */
async function assertSlotBookable(
  db: Db,
  p: SlotKey,
  settings: Awaited<ReturnType<typeof getSettings>>,
  excludeId?: string
): Promise<void> {
  const ahead = diffDays(todayStr(), p.date);
  if (ahead < 0) throw new HttpError(400, "La fecha ya pasó");
  if (ahead > settings.bookingWindowDays) {
    throw new HttpError(
      400,
      `Solo se puede reservar con hasta ${settings.bookingWindowDays} días de anticipación`
    );
  }
  // Anticipación mínima si es hoy
  if (ahead === 0) {
    const now = nowLocalParts();
    if (p.startMin < now.minutes + settings.minLeadMin) {
      throw new HttpError(400, "Ese horario ya pasó o no cumple la anticipación mínima");
    }
  }
  // Día libre del barbero
  const off = await db.dayOff.findUnique({
    where: { barberId_date: { barberId: p.barberId, date: p.date } },
  });
  if (off) throw new HttpError(400, "El barbero no trabaja ese día");
  // Dentro del horario laboral
  const hours = await db.workingHour.findMany({
    where: { barberId: p.barberId, weekday: getWeekday(p.date), active: true },
  });
  const fits = hours.some((h) => h.startMin <= p.startMin && p.endMin <= h.endMin);
  if (!fits) throw new HttpError(400, "Fuera del horario laboral del barbero");
  // Superposición (capa 2)
  if (await conflictsExist(db, p, excludeId)) {
    throw new HttpError(409, "Ese horario acaba de ser reservado. Elegí otro.");
  }
}

async function generateUniqueCode(db: Db): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const exists = await db.appointment.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new HttpError(500, "No se pudo generar el código del turno");
}

function messageData(a: AppointmentFull, shopName: string) {
  return {
    shopName,
    customerName: a.customerName,
    customerPhone: a.customerPhone,
    serviceName: a.service.name,
    barberName: a.barber.name,
    dateLong: formatDateLong(a.date),
    time: minToTime(a.startMin),
    price: a.service.price,
    currency: undefined as string | undefined,
    manageUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/turno/${a.code}`,
  };
}

// ── CREACIÓN PÚBLICA ──────────────────────────────────────────

export interface BookingInput {
  serviceId: string;
  barberId?: string; // undefined o "any" → asigna automáticamente
  date: string;
  startMin: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  notes?: string | null;
}

export interface BookingResult {
  /** Si hay pago online, appointment es null — se crea después del pago */
  appointment: AppointmentFull | null;
  payment: {
    preferenceId: string;
    initPoint: string;
    amount: number;
  } | null;
}

export async function createBooking(input: BookingInput): Promise<BookingResult> {
  const settings = await getSettings();

  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  if (!service || !service.active) {
    throw new HttpError(400, "El servicio no está disponible");
  }

  const mpConfigured = isMercadoPagoConfigured();
  const needsOnlinePayment =
    settings.depositEnabled &&
    settings.paymentMode !== "ON_SITE" &&
    mpConfigured;

  // ── PAGO ONLINE: solo crear preferencia MP, NADA en la DB ──
  if (needsOnlinePayment) {
    const paymentAmount = resolveAmount(
      settings.paymentMode,
      service.price,
      settings.depositPercent
    );

    const pref = await createMercadoPagoPreference({
      appointmentCode: "", // se llena después del pago
      title: `${service.name} — ${settings.shopName}`,
      unitPrice: paymentAmount,
      currency: settings.currency,
      payerEmail: input.customerEmail || null,
      // Guardamos todos los datos de reserva en metadata
      metadata: {
        serviceId: input.serviceId,
        barberId: input.barberId ?? "any",
        date: input.date,
        startMin: input.startMin,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        notes: input.notes ?? null,
      },
    });

    return {
      appointment: null,
      payment: {
        preferenceId: pref.id,
        initPoint: pref.initPoint,
        amount: paymentAmount,
      },
    };
  }

  // ── PAGO EN LOCAL / SIN DEPÓSITO: crear turno directamente ──
  const created = await prisma.$transaction(async (tx) => {
    const endMin = input.startMin + service.durationMin;
    const phone = normalizePhone(input.customerPhone);

    let candidates = await tx.barber.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    if (input.barberId && input.barberId !== "any") {
      candidates = candidates.filter((b) => b.id === input.barberId);
      if (candidates.length === 0) {
        throw new HttpError(400, "El barbero no está disponible");
      }
    }

    for (const barber of candidates) {
      const key: SlotKey = {
        barberId: barber.id,
        date: input.date,
        startMin: input.startMin,
        endMin,
      };
      try {
        await assertSlotBookable(tx, key, settings);
      } catch (err) {
        if (candidates.length > 1 && err instanceof HttpError && err.status !== 400) {
          continue;
        }
        if (candidates.length > 1) continue;
        throw err;
      }

      const customer = await tx.customer.upsert({
        where: { phone },
        update: { name: input.customerName },
        create: {
          phone,
          name: input.customerName,
          email: input.customerEmail || null,
        },
      });

      const appointment = await tx.appointment.create({
        data: {
          code: await generateUniqueCode(tx),
          status: APPOINTMENT_STATUS.CONFIRMED,
          date: input.date,
          startMin: input.startMin,
          endMin,
          barberId: barber.id,
          serviceId: service.id,
          customerName: input.customerName,
          customerPhone: phone,
          customerEmail: input.customerEmail || null,
          customerId: customer.id,
          notes: input.notes || null,
          source: "PUBLIC",
        },
        include: fullInclude,
      });

      const paymentAmount = resolveAmount(
        settings.paymentMode,
        service.price,
        settings.depositPercent
      );
      await tx.payment.create({
        data: {
          appointmentId: appointment.id,
          mode: settings.paymentMode,
          amount: paymentAmount,
          status: "PENDING_ON_SITE",
        },
      });

      return appointment;
    }
    throw new HttpError(
      409,
      "El horario acaba de ser reservado. Elegí otro horario."
    );
  }, TX_OPTS);

  void notifyAppointment("confirmed", messageData(created, settings.shopName));
  return { appointment: created, payment: null };
}

// ── CONFIRMACIÓN POST-PAGO (usado por /api/payments/success) ──

export interface ConfirmPaymentInput {
  serviceId: string;
  barberId: string;
  date: string;
  startMin: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  notes?: string | null;
  paymentExternalId: string;
  paymentAmount: number;
  paymentCurrency: string;
}

export async function confirmPaymentBooking(
  input: ConfirmPaymentInput
): Promise<AppointmentFull> {
  const settings = await getSettings();

  const created = await prisma.$transaction(async (tx) => {
    const service = await tx.service.findUnique({ where: { id: input.serviceId } });
    if (!service || !service.active) {
      throw new HttpError(400, "El servicio no está disponible");
    }
    const endMin = input.startMin + service.durationMin;
    const phone = normalizePhone(input.customerPhone);

    // Buscar barbero específico o asignar el primero disponible
    let candidates = await tx.barber.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    if (input.barberId && input.barberId !== "any") {
      candidates = candidates.filter((b) => b.id === input.barberId);
    }

    for (const barber of candidates) {
      const key: SlotKey = {
        barberId: barber.id,
        date: input.date,
        startMin: input.startMin,
        endMin,
      };
      try {
        await assertSlotBookable(tx, key, settings);
      } catch (err) {
        if (candidates.length > 1 && err instanceof HttpError && err.status !== 400) {
          continue;
        }
        if (candidates.length > 1) continue;
        throw err;
      }

      const customer = await tx.customer.upsert({
        where: { phone },
        update: { name: input.customerName },
        create: {
          phone,
          name: input.customerName,
          email: input.customerEmail || null,
        },
      });

      const appointment = await tx.appointment.create({
        data: {
          code: await generateUniqueCode(tx),
          status: APPOINTMENT_STATUS.CONFIRMED,
          date: input.date,
          startMin: input.startMin,
          endMin,
          barberId: barber.id,
          serviceId: service.id,
          customerName: input.customerName,
          customerPhone: phone,
          customerEmail: input.customerEmail || null,
          customerId: customer.id,
          notes: input.notes || null,
          source: "PUBLIC",
        },
        include: fullInclude,
      });

      await tx.payment.create({
        data: {
          appointmentId: appointment.id,
          mode: settings.paymentMode,
          amount: input.paymentAmount,
          status: "APPROVED",
          externalId: input.paymentExternalId,
        },
      });

      return appointment;
    }
    throw new HttpError(
      409,
      "Ese horario ya fue reservado por otra persona durante el pago. Elegí otro horario."
    );
  }, TX_OPTS);

  void notifyAppointment("confirmed", messageData(created, settings.shopName));
  return created;
}

// ── GESTIÓN POR CÓDIGO (cliente sin cuenta) ───────────────────

export async function getByCodePublic(code: string) {
  const a = await prisma.appointment.findUnique({
    where: { code: code.toUpperCase() },
    include: fullInclude,
  });
  if (!a) throw new HttpError(404, "Turno no encontrado");
  return {
    code: a.code,
    status: a.status,
    date: a.date,
    startTime: minToTime(a.startMin),
    endTime: minToTime(a.endMin),
    // ids expuestos para que la UI de reprogramar consulte la
    // disponibilidad del MISMO servicio y barbero del turno
    serviceId: a.service.id,
    barberId: a.barber.id,
    serviceName: a.service.name,
    servicePrice: a.service.price,
    barberName: a.barber.name,
    customerName: a.customerName.split(" ")[0], // nombre de pila solamente
    notes: a.notes,
  };
}

async function findOwnedAppointment(code: string, phone: string) {
  const a = await prisma.appointment.findUnique({
    where: { code: code.toUpperCase() },
    include: fullInclude,
  });
  if (!a) throw new HttpError(404, "Turno no encontrado");
  if (normalizePhone(phone) !== a.customerPhone) {
    throw new HttpError(403, "El teléfono no coincide con el turno");
  }
  return a;
}

export async function cancelByCode(
  code: string,
  phone: string,
  reason?: string
) {
  const settings = await getSettings();
  const updated = await prisma.$transaction(async (tx) => {
    const a = await findOwnedAppointment(code, phone);
    if (a.status === APPOINTMENT_STATUS.CANCELLED) return a; // idempotente
    return tx.appointment.update({
      where: { id: a.id },
      data: {
        status: APPOINTMENT_STATUS.CANCELLED,
        cancelReason: reason ?? "Cancelado por el cliente",
      },
      include: fullInclude,
    });
  }, TX_OPTS);
  void notifyAppointment("cancelled", messageData(updated, settings.shopName));
  return updated;
}

export async function rescheduleByCode(
  code: string,
  phone: string,
  date: string,
  startMin: number
) {
  const settings = await getSettings();
  const updated = await prisma.$transaction(async (tx) => {
    const a = await findOwnedAppointment(code, phone);
    if (a.status !== APPOINTMENT_STATUS.CONFIRMED) {
      throw new HttpError(400, "Solo se pueden reprogramar turnos confirmados");
    }
    const key: SlotKey = {
      barberId: a.barberId,
      date,
      startMin,
      endMin: startMin + a.service.durationMin,
    };
    await assertSlotBookable(tx, key, settings, a.id); // excluye este turno
    return tx.appointment.update({
      where: { id: a.id },
      data: {
        date,
        startMin,
        endMin: key.endMin,
        reminder24hAt: null, // reprogramar resetea recordatorios
        reminder1hAt: null,
      },
      include: fullInclude,
    });
  }, TX_OPTS);
  void notifyAppointment("rescheduled", messageData(updated, settings.shopName));
  return updated;
}

// ── ADMINISTRACIÓN ────────────────────────────────────────────

export interface AppointmentFilter {
  from?: string;
  to?: string;
  barberId?: string;
  status?: string;
  customerIdPhone?: string;
}

export async function listAppointments(f: AppointmentFilter) {
  const today = todayStr();
  return prisma.appointment.findMany({
    where: {
      date: f.from || f.to ? { gte: f.from ?? today, lte: f.to ?? f.from ?? today } : undefined,
      barberId: f.barberId || undefined,
      status: f.status || undefined,
      customerPhone: f.customerIdPhone
        ? normalizePhone(f.customerIdPhone)
        : undefined,
    },
    include: fullInclude,
    orderBy: [{ date: "asc" }, { startMin: "asc" }],
  });
}

export async function getAppointment(id: string) {
  const a = await prisma.appointment.findUnique({
    where: { id },
    include: fullInclude,
  });
  if (!a) throw new HttpError(404, "Turno no encontrado");
  return a;
}

export interface AdminUpdatePatch {
  date?: string;
  startMin?: number;
  barberId?: string;
  serviceId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  notes?: string | null;
  status?: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  cancelReason?: string;
}

export async function adminUpdate(id: string, patch: AdminUpdatePatch) {
  const settings = await getSettings();

  // Datos actuales + servicio efectivo (para recalcular duración)
  const current = await getAppointment(id);

  const effective = {
    barberId: patch.barberId ?? current.barberId,
    date: patch.date ?? current.date,
    startMin: patch.startMin ?? current.startMin,
    serviceId: patch.serviceId ?? current.serviceId,
    status: patch.status ?? current.status,
  };

  let durationMin = current.service.durationMin;
  if (patch.serviceId && patch.serviceId !== current.serviceId) {
    const svc = await prisma.service.findUnique({ where: { id: patch.serviceId } });
    if (!svc) throw new HttpError(404, "Servicio no encontrado");
    durationMin = svc.durationMin;
  }

  const slotChanged =
    effective.barberId !== current.barberId ||
    effective.date !== current.date ||
    effective.startMin !== current.startMin ||
    (patch.serviceId && patch.serviceId !== current.serviceId);

  const updated = await prisma.$transaction(async (tx) => {
    if (slotChanged && effective.status === APPOINTMENT_STATUS.CONFIRMED) {
      await assertSlotBookable(
        tx,
        {
          barberId: effective.barberId,
          date: effective.date,
          startMin: effective.startMin,
          endMin: effective.startMin + durationMin,
        },
        settings,
        id
      );
    }
    return tx.appointment.update({
      where: { id },
      data: {
        ...patch,
        ...(slotChanged
          ? {
              endMin: effective.startMin + durationMin,
              reminder24hAt: null,
              reminder1hAt: null,
            }
          : {}),
      },
      include: fullInclude,
    });
  }, TX_OPTS);

  if (slotChanged && updated.status === APPOINTMENT_STATUS.CONFIRMED) {
    void notifyAppointment("rescheduled", messageData(updated, settings.shopName));
  }
  if (updated.status === APPOINTMENT_STATUS.CANCELLED &&
      current.status !== APPOINTMENT_STATUS.CANCELLED) {
    void notifyAppointment("cancelled", messageData(updated, settings.shopName));
  }
  return updated;
}

/** Borrado físico definitivo (solo admin, uso excepcional). */
export async function hardDelete(id: string) {
  const a = await prisma.appointment.delete({ where: { id } }).catch(() => null);
  if (!a) throw new HttpError(404, "Turno no encontrado");
  return { deleted: true };
}
