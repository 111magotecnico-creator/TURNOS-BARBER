"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Calendar } from "@/components/public/Calendar";
import { TimeSlots } from "@/components/public/TimeSlots";
import { ErrorState, Spinner } from "@/components/ui/States";
import { apiFetch } from "@/lib/client";
import { formatDateLong, formatMoney, minToTime, todayStr } from "@/lib/utils";
import type { SettingsDTO, Slot } from "@/types";

// ═════════════════════════════════════════════════════════
// GESTIÓN DE TURNO SIN CUENTA.
// El código lo conoce solo el cliente; las mutaciones exigen
// además el teléfono usado en la reserva (verificación server).
// Reprogramar ACTUALIZA el mismo turno (nunca duplica).
// ═════════════════════════════════════════════════════════

interface PublicAppointment {
  code: string;
  status: string;
  date: string;
  startTime: string;
  endTime: string;
  serviceId: string;
  barberId: string;
  serviceName: string;
  servicePrice: number;
  barberName: string;
  customerName: string;
}

type Mode = "view" | "reschedule";

export default function TurnoPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = use(params);
  const code = decodeURIComponent(rawCode).toUpperCase();

  const [appt, setAppt] = useState<PublicAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("view");
  const [newDate, setNewDate] = useState<string | null>(null);
  const [newSlot, setNewSlot] = useState<Slot | null>(null);

  const { data: settings } = useSettingsSafe();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PublicAppointment>(`/api/manage/${code}`);
      setAppt(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  // carga inicial
  useMemo(() => void load(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // disponibilidad para reprogramar: mismo servicio y MISMO barbero
  // del turno (el cambio conserva el profesional asignado)
  const slotsUrl =
    mode === "reschedule" && appt?.serviceId && newDate
      ? `/api/availability?serviceId=${appt.serviceId}&date=${newDate}&barberId=${appt.barberId}`
      : null;
  const { data: availability, loading: loadingSlots } =
    useAvailability(slotsUrl);

  async function reschedule() {
    if (!newSlot || !newDate) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/api/manage/${code}`, {
        method: "PUT",
        json: { phone, date: newDate, startMin: newSlot.minute },
      });
      setMode("view");
      setNewSlot(null);
      setNewDate(null);
      await load();
      alert("Turno reprogramado ✓");
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm("¿Querés cancelar tu turno? Esta acción no se puede deshacer."))
      return;
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/api/manage/${code}/cancel`, {
        method: "POST",
        json: { phone, reason: "Cancelado por el cliente" },
      });
      await load();
      alert("Turno cancelado");
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-6 text-center text-2xl font-extrabold">
        Tu turno <span className="text-accent">{code}</span>
      </h1>

      {loading && <Spinner label="Buscando tu turno..." />}
      {error && (
        <>
          <ErrorState message={error} />
          <p className="mt-4 text-center text-sm text-muted">
            Revisá el código o{" "}
            <Link href="/reservar" className="text-accent hover:underline">
              reservá un nuevo turno
            </Link>
            .
          </p>
        </>
      )}

      {appt && (
        <>
          <Card className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <Badge status={appt.status} />
              <span className="text-xs text-muted">
                A nombre de: {appt.customerName}
              </span>
            </div>
            <dl className="grid gap-2 text-sm">
              <Row icon="✂️" value={`${appt.serviceName} · ${formatMoney(appt.servicePrice, settings?.currency)}`} />
              <Row icon="💈" value={`con ${appt.barberName}`} />
              <Row icon="📅" value={formatDateLong(appt.date)} />
              <Row icon="⏰" value={`${appt.startTime} hs`} />
            </dl>
          </Card>

          {appt.status === "CONFIRMED" ? (
            <>
              {!mode || mode === "view" ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <Button variant="ghost" onClick={() => setMode("reschedule")}>
                    📅 Reprogramar
                  </Button>
                  <Button variant="danger" loading={busy} onClick={cancel}>
                    Cancelar turno
                  </Button>
                </div>
              ) : (
                /* ── MODO REPROGRAMAR ── */
                <Card>
                  <h2 className="mb-1 font-bold">Elegí nuevo día y horario</h2>
                  <p className="mb-4 text-xs text-muted">
                    Tu turno se actualizará, no se crea uno nuevo.
                  </p>
                  <Field label="Teléfono de la reserva" required>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+54 9 11 5555-0000"
                      inputMode="tel"
                      className="mb-4"
                    />
                  </Field>
                  <div className="mb-4">
                    <Calendar
                      value={newDate}
                      onChange={(d) => { setNewDate(d); setNewSlot(null); }}
                      maxDaysAhead={settings?.bookingWindowDays ?? 30}
                    />
                  </div>
                  <TimeSlots
                    slots={availability?.slots}
                    loading={loadingSlots && Boolean(slotsUrl)}
                    selectedMinute={newSlot?.minute ?? null}
                    onSelect={setNewSlot}
                  />
                  {actionError && (
                    <p className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                      {actionError}
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    <Button variant="ghost" onClick={() => { setMode("view"); setActionError(null); }}>
                      Volver
                    </Button>
                    <Button
                      onClick={reschedule}
                      loading={busy}
                      disabled={!newSlot || !newDate || phone.trim().length < 6}
                    >
                      Confirmar cambio
                    </Button>
                  </div>
                </Card>
              )}

              {/* Teléfono requerido también para cancelar */}
              {(mode === "view") && (
                <div className="mt-4">
                  <Field label="Para gestionar, ingresá el teléfono de la reserva" required>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+54 9 11 5555-0000"
                      inputMode="tel"
                    />
                  </Field>
                </div>
              )}
              {actionError && mode === "view" && (
                <p className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {actionError}
                </p>
              )}
            </>
          ) : (
            <p className="rounded-card border border-dashed border-line py-6 text-center text-sm text-muted">
              Este turno está {appt.status === "CANCELLED" ? "cancelado" : "completado"}.
              {" "}
              <Link href="/reservar" className="text-accent hover:underline">
                Reservar otro →
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Row({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden>{icon}</span>
      <dd>{value}</dd>
    </div>
  );
}

// Hooks pequeños para no repetir useApi genérico en este archivo
import { useApi } from "@/hooks/useApi";
function useSettingsSafe() {
  return useApi<SettingsDTO>("/api/settings");
}
function useAvailability(url: string | null) {
  return useApi<{ slots: Slot[] }>(url);
}
