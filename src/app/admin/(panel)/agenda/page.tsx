"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { Calendar } from "@/components/public/Calendar";
import { TimeSlots } from "@/components/public/TimeSlots";
import { Field, Input } from "@/components/ui/Input";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/client";
import {
  addDaysStr,
  formatDateShort,
  formatMoney,
  minToTime,
  todayStr,
  weekdayName,
  getWeekday,
} from "@/lib/utils";
import type { AppointmentDTO, BarberDTO, ServiceDTO, SettingsDTO, Slot } from "@/types";

// ═════════════════════════════════════════════════════════
// AGENDA — vista Día (tarjetas por turno) + tira semanal.
// Crear / editar (reprograma) / cancelar desde acá.
// ═════════════════════════════════════════════════════════

export default function AgendaPage() {
  const [day, setDay] = useState(todayStr());
  const [barberFilter, setBarberFilter] = useState<string>("");

  const weekDays = useMemo(() => {
    const base = todayStr();
    // Lunes de la semana actual
    const wd = getWeekday(base);
    const monday = addDaysStr(base, -wd);
    return Array.from({ length: 7 }, (_, i) => addDaysStr(monday, i));
  }, []);

  const url = `/api/appointments?from=${day}&to=${day}${barberFilter ? `&barberId=${barberFilter}` : ""}`;
  const { data: appointments, loading, error, refresh } = useApi<AppointmentDTO[]>(url);
  const { data: barbers } = useApi<BarberDTO[]>("/api/barbers");
  const { data: settings } = useApi<SettingsDTO>("/api/settings");

  const [editing, setEditing] = useState<AppointmentDTO | null>(null);
  const [creating, setCreating] = useState(false);

  async function setStatus(a: AppointmentDTO, status: string) {
    if (
      status === "CANCELLED" &&
      !confirm(`¿Cancelar el turno de ${a.customerName} a las ${a.startTime}?`)
    )
      return;
    await apiFetch(`/api/appointments/${a.id}`, {
      method: "PATCH",
      json: { status, ...(status === "CANCELLED" ? { cancelReason: "Cancelado por la barbería" } : {}) },
    });
    void refresh();
  }

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Agenda</h1>
          <p className="text-sm text-muted">{weekdayName(getWeekday(day))} {formatDateShort(day)}</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Nuevo turno</Button>
      </header>

      {/* Tira semanal */}
      <div className="mb-4 grid grid-cols-7 gap-1.5">
        {weekDays.map((d) => {
          const selected = d === day;
          const wd = getWeekday(d);
          return (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`rounded-xl border py-2 text-center transition ${
                selected ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <span className="block text-[10px] font-semibold uppercase opacity-70">
                {weekdayName(wd).slice(0, 2)}
              </span>
              <span className="block text-base font-bold">{Number(d.slice(8))}</span>
            </button>
          );
        })}
      </div>

      {/* Filtro barbero */}
      <select
        value={barberFilter}
        onChange={(e) => setBarberFilter(e.target.value)}
        className="mb-4 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
      >
        <option value="">Todos los barberos</option>
        {barbers?.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>

      {loading && <Spinner label="Cargando agenda..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && appointments?.length === 0 && (
        <EmptyState
          title="Sin turnos este día"
          hint="Los turnos que crees o reciba la web aparecerán acá."
          action={<Button onClick={() => setCreating(true)}>Crear turno</Button>}
        />
      )}

      <ul className="grid gap-2.5">
        {appointments?.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-line bg-surface p-4">
            <span className={`w-14 shrink-0 text-lg font-extrabold ${a.status === "CANCELLED" ? "text-muted line-through" : "text-accent"}`}>
              {a.startTime}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`truncate font-semibold ${a.status === "CANCELLED" ? "text-muted line-through" : ""}`}>
                {a.customerName}
              </p>
              <p className="truncate text-xs text-muted">
                {a.serviceName} · {formatMoney(a.servicePrice, settings?.currency)} · {a.barberName}
              </p>
            </div>
            <Badge status={a.status} label={a.status === "CONFIRMED" ? "Confirmado" : a.status === "COMPLETED" ? "Completado" : "Cancelado"} />
            {a.status !== "CANCELLED" && (
              <div className="flex gap-1.5">
                {a.status === "CONFIRMED" && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(a, "COMPLETED")}>
                    ✓ Completar
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                  Editar
                </Button>
                <Button size="sm" variant="danger" onClick={() => setStatus(a, "CANCELLED")}>
                  ✕
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Modales */}
      <AppointmentFormModal
        open={creating}
        onClose={() => setCreating(false)}
        initialDate={day}
        defaultBarber={barberFilter || undefined}
        onSaved={() => { setCreating(false); void refresh(); }}
      />
      {editing && (
        <AppointmentFormModal
          open
          appointment={editing}
          initialDate={editing.date}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void refresh(); }}
        />
      )}
    </div>
  );
}

// ── Modal crear/editar ─────────────────────────────────────

function AppointmentFormModal({
  open,
  onClose,
  onSaved,
  appointment,
  initialDate,
  defaultBarber,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  appointment?: AppointmentDTO;
  initialDate?: string;
  defaultBarber?: string;
}) {
  const isEdit = Boolean(appointment);
  const { data: services } = useApi<ServiceDTO[]>("/api/services?all=1");
  const { data: barbers } = useApi<BarberDTO[]>("/api/barbers");

  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? "");
  const [barberId, setBarberId] = useState(appointment?.barberId ?? defaultBarber ?? "");
  const [date, setDate] = useState(initialDate ?? todayStr());
  const [slot, setSlot] = useState<Slot | null>(
    appointment ? { minute: appointment.startMin, time: appointment.startTime, barberIds: [] } : null
  );
  const [name, setName] = useState(appointment?.customerName ?? "");
  const [phone, setPhone] = useState(appointment?.customerPhone ?? "");
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const slotsUrl =
    serviceId && date && barberId
      ? `/api/availability?serviceId=${serviceId}&date=${date}&barberId=${barberId}`
      : null;
  const { data: availability, loading: loadingSlots } = useApi<{ slots: Slot[] }>(slotsUrl);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      if (isEdit && appointment) {
        await apiFetch(`/api/appointments/${appointment.id}`, {
          method: "PATCH",
          json: { serviceId, barberId, date, startMin: slot!.minute, customerName: name, customerPhone: phone, notes },
        });
      } else {
        await apiFetch("/api/appointments", {
          method: "POST",
          json: { serviceId, barberId, date, startMin: slot!.minute, customerName: name, customerPhone: phone, notes },
        });
      }
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const valid = serviceId && barberId && date && slot && name.trim().length >= 2 && phone.trim().length >= 6;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Editar turno" : "Nuevo turno"} wide>
      <div className="grid gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Servicio" required>
            <select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSlot(null); }} className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent">
              <option value="" disabled>Elegir…</option>
              {services?.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.durationMin}min)</option>
              ))}
            </select>
          </Field>
          <Field label="Barbero" required>
            <select value={barberId} onChange={(e) => { setBarberId(e.target.value); setSlot(null); }} className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent">
              <option value="" disabled>Elegir…</option>
              {barbers?.filter((b) => b.active).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Cliente" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
          </Field>
          <Field label="Teléfono" required>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 9 11 …" inputMode="tel" />
          </Field>
        </div>

        <Calendar value={date} onChange={(d) => { setDate(d); setSlot(null); }} maxDaysAhead={60} />

        <TimeSlots
          slots={availability?.slots}
          loading={loadingSlots && Boolean(slotsUrl)}
          selectedMinute={slot?.minute ?? null}
          onSelect={setSlot}
        />

        <Field label="Notas">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </Field>

        {err && <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!valid || busy} loading={busy}>
            {isEdit ? "Guardar cambios" : "Crear turno"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
