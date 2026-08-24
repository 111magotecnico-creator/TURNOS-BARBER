import {
  CODE_ALPHABET,
  CODE_LENGTH,
  WEEKDAYS,
} from "@/config";

// ═════════════════════════════════════════════════════════
// Utilidades de fecha/hora.
//
// REGLA DE ORO: las fechas del dominio son strings "YYYY-MM-DD"
// en hora local de la barbería. Nunca usar toISOString() para
// fechas de agenda (convierte a UTC y corre el día).
//
// Para obtener el día de la semana se construye Date al mediodía
// local, inmune a cambios de horario/UTC.
// ═════════════════════════════════════════════════════════

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Valida formato YYYY-MM-DD (y que sea una fecha real). */
export function isValidDateStr(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12);
  return (
    dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  );
}

/** Date (local) → "YYYY-MM-DD". */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" → Date local (mediodía, seguro para operaciones). */
export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Fecha de hoy en hora local. */
export function todayStr(): string {
  return toDateStr(new Date());
}

/** Suma días a un date-string. */
export function addDaysStr(s: string, days: number): string {
  const d = fromDateStr(s);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/** Diferencia en días entre dos date-strings (b - a). */
export function diffDays(a: string, b: string): number {
  const MS_DAY = 86_400_000;
  return Math.round((fromDateStr(b).getTime() - fromDateStr(a).getTime()) / MS_DAY);
}

/**
 * Día de semana con convención 0=Lunes ... 6=Domingo.
 * (JS nativo devuelve 0=Domingo; se re-mapea.)
 */
export function getWeekday(dateStr: string): number {
  return (fromDateStr(dateStr).getDay() + 6) % 7;
}

/** "YYYY-MM-DD" → "lunes 12 de mayo" (es-AR). */
export function formatDateLong(dateStr: string): string {
  return fromDateStr(dateStr).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "YYYY-MM-DD" → "12/05/2026". */
export function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// ── Minutos ↔ "HH:mm" ─────────────────────────────────────────

export function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Momento actual desglosado en fecha local + minuto del día. */
export function nowLocalParts(): { date: string; minutes: number } {
  const now = new Date();
  return { date: toDateStr(now), minutes: now.getHours() * 60 + now.getMinutes() };
}

// ── Intervalos ────────────────────────────────────────────────

/** ¿[aStart,aEnd) y [bStart,bEnd) se superponen? */
export function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ── Varios ────────────────────────────────────────────────────

/** $26.000 (es-AR). */
export function formatMoney(amount: number, currency = "ARS"): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString("es-AR")}`;
  }
}

/** Código público aleatorio sin caracteres confundibles. */
export function generateCode(len = CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/** Nombre de día desde índice 0=Lunes. */
export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday] ?? "";
}

/** Normaliza teléfono: deja dígitos solamente. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
