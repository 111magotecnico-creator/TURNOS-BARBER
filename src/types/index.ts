// Tipos de dominio compartidos entre frontend y backend.

export interface Interval {
  start: number; // minutos desde medianoche (incluyente)
  end: number; // excluyente
}

/** Datos que el motor necesita de CADA barbero para un día dado. */
export interface BarberDayInput {
  barberId: string;
  /** Jornadas laborales activas del día (puede haber varias: turno partido). */
  workingIntervals: Interval[];
  /** Turnos confirmados ya agendados ese día. */
  busy: Interval[];
  /** Bloqueos manuales ese día. */
  blocked: Interval[];
  isDayOff: boolean;
}

export interface SlotInput {
  barbers: BarberDayInput[];
  durationMin: number;
  slotStepMin: number;
  /**
   * Minuto a partir del cual se aceptan turnos.
   * Para "hoy" se calcula como ahora + anticipación mínima.
   * Si la fecha es futura, pasar 0.
   */
  minStart?: number;
}

export interface Slot {
  minute: number;
  time: string; // "HH:mm"
  barberIds: string[]; // barberos libres en ese horario
}

// ── Entidades serializadas que viajan por la API ──────────────

export interface ServiceDTO {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMin: number;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
}

export interface BarberDTO {
  id: string;
  name: string;
  specialty: string | null;
  description: string | null;
  photoUrl: string | null;
  active: boolean;
  sortOrder: number;
}

export interface WorkingHourDTO {
  id?: string;
  weekday: number; // 0=Lunes ... 6=Domingo
  startMin: number;
  endMin: number;
  active: boolean;
}

export type AppointmentStatusDTO = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export interface AppointmentDTO {
  id: string;
  code: string;
  status: AppointmentStatusDTO;
  date: string; // YYYY-MM-DD
  startMin: number;
  endMin: number;
  startTime: string; // "HH:mm"
  endTime: string;
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  serviceDurationMin: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  notes: string | null;
  source: string;
  createdAt: string;
}

export interface SettingsDTO {
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
}
