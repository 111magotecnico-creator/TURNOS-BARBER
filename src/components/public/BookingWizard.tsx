"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { ErrorState, Spinner } from "@/components/ui/States";
import { Calendar } from "./Calendar";
import { TimeSlots } from "./TimeSlots";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/client";
import {
  addDaysStr,
  formatDateLong,
  formatMoney,
  todayStr,
} from "@/lib/utils";
import type { BarberDTO, ServiceDTO, SettingsDTO, Slot } from "@/types";

// ═════════════════════════════════════════════════════════
// WIZARD DE RESERVA — flujo completo en 7 pasos.
// Estado local simple y lineal: cada paso habilita el siguiente.
// La validación final reutiliza el MISMO schema Zod del backend.
// ═════════════════════════════════════════════════════════

interface CreatedAppointment {
  code: string;
  date: string;
  startMin: number;
  endMin: number;
  barberName: string;
  serviceName: string;
}

interface PaymentOnly {
  payment: {
    preferenceId: string;
    initPoint: string;
    amount: number;
  };
}

const STEPS = ["Servicio", "Barbero", "Fecha", "Horario", "Datos", "Confirmar"];

export function BookingWizard() {
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ customerName: "", customerPhone: "", customerEmail: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedAppointment | null>(null);

  const { data: services, loading: loadingS } = useApi<ServiceDTO[]>("/api/services");
  const { data: barbers } = useApi<BarberDTO[]>("/api/barbers");
  const { data: settings } = useApi<SettingsDTO>("/api/settings");

  // Disponibilidad: se consulta solo cuando hay servicio + fecha
  const availabilityUrl =
    serviceId && date && step >= 4
      ? `/api/availability?serviceId=${serviceId}&date=${date}&barberId=${barberId ?? "any"}`
      : null;
  const { data: availability, loading: loadingSlots, error: slotsError, refresh: refreshSlots } =
    useApi<{ slots: Slot[]; durationMin: number }>(availabilityUrl);

  const service = useMemo(
    () => services?.find((s) => s.id === serviceId) ?? null,
    [services, serviceId]
  );
  const barber = useMemo(
    () => barbers?.find((b) => b.id === barberId) ?? null,
    [barbers, barberId]
  );

  const maxWindow = settings?.bookingWindowDays ?? 30;

  async function confirm() {
    if (!service || !slot || !date) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await apiFetch<CreatedAppointment | PaymentOnly>(
        "/api/appointments",
        {
          method: "POST",
          json: {
            serviceId: service.id,
            barberId: barberId ?? "any",
            date,
            startMin: slot.minute,
            ...form,
          },
        }
      );
      // Si la respuesta tiene payment.initPoint → redirigir a MP AHORA
      if ("payment" in result && result.payment.initPoint) {
        window.location.href = result.payment.initPoint;
        return;
      }
      // Sin pago → mostrar pantalla de confirmación
      setCreated(result as CreatedAppointment);
    } catch (e) {
      const msg = (e as Error).message;
      setSubmitError(msg);
      if (msg.includes("horario") || msg.includes("reservado")) {
        setStep(4);
        setSlot(null);
        void refreshSlots();
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Pantalla final ─────────────────────────────────────────
  if (created) {
    return (
      <ConfirmationScreen
        created={created}
        settings={settings}
        onReset={() => {
          setCreated(null);
          setStep(1); setServiceId(null); setBarberId(null);
          setDate(null); setSlot(null);
          setForm({ customerName: "", customerPhone: "", customerEmail: "", notes: "" });
        }}
      />
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
      {/* Stepper */}
      <ol className="mb-4 flex items-center gap-0.5 overflow-x-auto pb-1 text-[10px] font-semibold sm:mb-6 sm:gap-1 sm:text-xs">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const current = step === n;
          return (
            <li key={label} className="flex items-center gap-0.5 whitespace-nowrap sm:gap-1">
              <button
                type="button"
                onClick={() => n < step && setStep(n)}
                className={`flex h-6 w-6 items-center justify-center rounded-full border transition sm:h-7 sm:w-7 ${
                  current
                    ? "border-accent bg-accent text-accent-ink"
                    : done
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-line text-muted"
                }`}
                aria-current={current ? "step" : undefined}
              >
                {done ? "✓" : n}
              </button>
              <span className={current ? "text-ink" : "text-muted"}>{label}</span>
              {n < STEPS.length && <span className="mx-0.5 text-line-strong sm:mx-1">—</span>}
            </li>
          );
        })}
      </ol>

      {/* PASO 1: Servicio */}
      {step === 1 && (
        <Section title="Elegí tu servicio">
          {loadingS ? (
            <Spinner label="Cargando servicios..." />
          ) : (
            <div className="grid gap-2 sm:gap-2.5">
              {services?.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setServiceId(s.id); setStep(2); }}
                  style={{ width: "100%", overflow: "hidden" }}
                  className={`rounded-card border p-3 text-left transition active:scale-[.99] sm:p-4 ${
                    s.id === serviceId
                      ? "border-accent bg-accent/10"
                      : "border-line bg-surface hover:border-line-strong"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{s.name}</p>
                      <p className="mt-0.5 text-xs text-muted line-clamp-2">{s.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-extrabold text-accent">
                        {formatMoney(s.price, settings?.currency)}
                      </p>
                      <p className="text-[10px] text-muted sm:text-xs">{s.durationMin} min</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* PASO 2: Barbero */}
      {step === 2 && (
        <Section title="¿Con quién querés atenderte?">
          <div className="grid gap-2.5">
            <SelectableCard
              selected={barberId === "any"}
              onClick={() => { setBarberId("any"); setStep(3); }}
              emoji="⚡"
              title="Cualquier barbero"
              subtitle="Te asignamos automáticamente el primero disponible en tu horario"
            />
            {barbers?.filter((b) => b.active).map((b) => (
              <SelectableCard
                key={b.id}
                selected={b.id === barberId}
                onClick={() => { setBarberId(b.id); setStep(3); }}
                initials={b.name.slice(0, 2).toUpperCase()}
                title={b.name}
                subtitle={b.specialty ?? undefined}
              />
            ))}
          </div>
        </Section>
      )}

      {/* PASO 3: Fecha */}
      {step === 3 && (
        <Section title="Elegí el día">
          <Calendar
            value={date}
            onChange={(d) => { setDate(d); setSlot(null); setStep(4); }}
            maxDaysAhead={maxWindow}
          />
          <p className="mt-3 text-center text-xs text-muted">
            Podés reservar hasta {maxWindow} días de anticipación
          </p>
        </Section>
      )}

      {/* PASO 4: Horario */}
      {step === 4 && (
        <Section title={`Horarios · ${date ? formatDateLong(date) : ""}`}>
          {slotsError ? (
            <ErrorState message={slotsError} />
          ) : (
            <>
              <TimeSlots
                slots={availability?.slots}
                loading={loadingSlots}
                selectedMinute={slot?.minute ?? null}
                onSelect={(s) => { setSlot(s); setStep(5); }}
              />
              {barberId === "any" && availability?.slots?.length ? (
                <p className="mt-3 text-center text-xs text-muted">
                  Los horarios combinan la disponibilidad de todos los barberos
                </p>
              ) : null}
            </>
          )}
        </Section>
      )}

      {/* PASO 5: Datos */}
      {step === 5 && (
        <Section title="Tus datos">
          <div className="grid gap-3.5">
            <Field label="Nombre y apellido" required>
              <Input
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="Juan Pérez"
                autoComplete="name"
              />
            </Field>
            <Field label="Teléfono / WhatsApp" required hint="Con código de país si es posible">
              <Input
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                placeholder="+54 9 11 5555-0000"
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>
            <Field label="Email (opcional)">
              <Input
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                placeholder="juan@email.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Notas (opcional)">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Alguna preferencia o comentario..."
                maxLength={300}
              />
            </Field>
            <Button
              size="lg"
              fullWidth
              onClick={() => setStep(6)}
              disabled={
                form.customerName.trim().length < 2 ||
                form.customerPhone.trim().length < 6
              }
            >
              Continuar
            </Button>
          </div>
        </Section>
      )}

      {/* PASO 6: Confirmación */}
      {step === 6 && service && date && slot && (
        <Section title="Revisá y confirmá">
          <Card className="mb-4 grid grid-cols-2 gap-y-3 text-sm">
            <SummaryRow label="Servicio" value={service.name} />
            <SummaryRow label="Duración" value={`${service.durationMin} min`} />
            <SummaryRow label="Barbero" value={barberId === "any" ? "El primero disponible" : (barber?.name ?? "-")} />
            <SummaryRow
              label="Precio"
              value={formatMoney(service.price, settings?.currency)}
              accent
            />
            {settings?.depositEnabled &&
              settings.paymentMode !== "ON_SITE" &&
              settings.depositPercent > 0 && (
                <SummaryRow
                  label={`Seña (${settings.depositPercent}%)`}
                  value={formatMoney(
                    Math.max(1, Math.round((service.price * settings.depositPercent) / 100)),
                    settings?.currency
                  )}
                  accent
                />
              )}
            <SummaryRow label="Fecha" value={formatDateLong(date)} />
            <SummaryRow label="Hora" value={slot.time} />
            <div className="col-span-2 border-t border-line pt-3">
              <SummaryRow label="A nombre de" value={form.customerName} />
            </div>
          </Card>

          {submitError && (
            <p className="mb-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {submitError}
            </p>
          )}

          <Button size="lg" fullWidth loading={submitting} onClick={confirm}>
            {settings?.depositEnabled &&
            settings.paymentMode !== "ON_SITE" &&
            settings.depositPercent > 0
              ? "RESERVAR Y PAGAR SEÑA"
              : "CONFIRMAR TURNO"}
          </Button>
        </Section>
      )}

      {/* Navegación atrás */}
      {step > 1 && !submitting && (
        <button
          onClick={() => setStep(step - 1)}
          className="mt-4 text-sm text-muted transition hover:text-ink"
        >
          ← Atrás
        </button>
      )}
    </div>
  );
}

// ── Piezas internas ────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-base font-bold sm:mb-4 sm:text-lg">{title}</h2>
      {children}
    </div>
  );
}

function SelectableCard({
  selected,
  onClick,
  title,
  subtitle,
  right,
  initials,
  emoji,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  initials?: string;
  emoji?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: "100%", overflow: "hidden" }}
      className={`flex items-center gap-2.5 rounded-card border p-3 text-left transition active:scale-[.99] sm:gap-3 sm:p-4 ${
        selected
          ? "border-accent bg-accent/10"
          : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      {initials && (
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-extrabold ${
            selected ? "bg-accent text-accent-ink" : "bg-accent/15 text-accent"
          }`}
        >
          {initials}
        </span>
      )}
      {emoji && <span className="shrink-0 text-2xl">{emoji}</span>}
      <span className="min-w-0 flex-1 truncate">
        <span className="block font-bold">{title}</span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>
        )}
      </span>
      {right && <span className="shrink-0">{right}</span>}
    </button>
  );
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`font-semibold ${accent ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}

function ConfirmationScreen({
  created,
  settings,
  onReset,
}: {
  created: CreatedAppointment;
  settings?: SettingsDTO | null;
  onReset: () => void;
}) {
  const time = `${String(Math.floor(created.startMin / 60)).padStart(2, "0")}:${String(created.startMin % 60).padStart(2, "0")}`;

  function downloadIcs() {
    const d = created.date.replace(/-/g, "");
    const t = time.replace(":", "");
    const endH = String(created.endMin).padStart(4, "0");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${d}T${t}00`,
      `DTEND:${d}T${endH}00`,
      `SUMMARY:${created.serviceName} - ${settings?.shopName ?? "Barbería"}`,
      `DESCRIPTION:Barbero: ${created.barberName}. Código de turno: ${created.code}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `turno-${created.code}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-4xl">
        ✅
      </div>
      <h1 className="text-2xl font-extrabold sm:text-3xl">¡Turno confirmado!</h1>
      <p className="mt-2 text-sm text-muted">
        Guardá este código para gestionarlo después:
      </p>
      <p className="my-4 rounded-card border border-dashed border-accent/50 bg-accent/5 py-3 text-3xl font-black tracking-[0.35em] text-accent">
        {created.code}
      </p>

      <Card className="mb-5 text-left">
        <dl className="grid gap-2.5 text-sm">
          <ConfirmRow icon="✂️" label={created.serviceName} />
          <ConfirmRow icon="💈" label={`con ${created.barberName}`} />
          <ConfirmRow icon="📅" label={formatDateLong(created.date)} />
          <ConfirmRow icon="⏰" label={`${time} hs`} />
          {settings?.address && <ConfirmRow icon="📍" label={settings.address} />}
        </dl>
      </Card>

      <div className="grid gap-2.5">
        <Button variant="primary" onClick={downloadIcs}>
          📥 Agregar al calendario
        </Button>
        <Link
          href={`/turno/${created.code}`}
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium transition hover:border-line-strong"
        >
          Gestionar turno (cancelar / reprogramar)
        </Link>
        {settings?.whatsapp && (
          <a
            href={`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(
              `Hola! Tengo un turno con código ${created.code}`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium transition hover:border-line-strong"
          >
            💬 Contactar por WhatsApp
          </a>
        )}
        <Button variant="subtle" onClick={onReset}>
          Reservar otro turno
        </Button>
      </div>
    </div>
  );
}

function ConfirmRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden>{icon}</span>
      <dt className="sr-only" />
      <dd>{label}</dd>
    </div>
  );
}
