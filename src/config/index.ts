// ═════════════════════════════════════════════════════════
// Constantes de negocio del sistema de turnos.
// Modificá acá para cambiar el comportamiento global.
// ═════════════════════════════════════════════════════════

/** Granularidad por defecto de los slots ofrecidos (minutos). */
export const DEFAULT_SLOT_STEP_MIN = 15;

/** Anticipación mínima para reservar respecto a "ahora" (minutos). */
export const DEFAULT_MIN_LEAD_MIN = 60;

/** Ventana máxima de reserva hacia adelante (días). */
export const DEFAULT_BOOKING_WINDOW_DAYS = 30;

/**
 * Convención de días: 0=Lunes ... 6=Domingo.
 * (getDay() de JS devuelve 0=Domingo; usar getWeekday() de utils.)
 */
export const WEEKDAYS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export const APPOINTMENT_STATUS = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;

export type AppointmentStatus =
  (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS];

/** Estados que ocupan lugar en la agenda (bloquean el slot). */
export const BLOCKING_STATUSES: string[] = [
  APPOINTMENT_STATUS.PENDING_PAYMENT,
  APPOINTMENT_STATUS.CONFIRMED,
];

export const PAYMENT_MODES = {
  FULL: "FULL",
  DEPOSIT: "DEPOSIT",
  ON_SITE: "ON_SITE",
} as const;

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REFUNDED: "REFUNDED",
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

/** Longitud del código público de turno (ej: A7X3K9). */
export const CODE_LENGTH = 6;

/** Alfabeto sin caracteres confundibles (0/O, 1/I/L). */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
