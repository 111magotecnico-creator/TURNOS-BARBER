"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { EmptyState, Spinner } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/client";
import { formatMoney } from "@/lib/utils";
import type { ServiceDTO, SettingsDTO } from "@/types";

// ═════════════════════════════════════════════════════════
// SERVICIOS — catálogo visible en la web. Precio entero en
// la moneda configurada; duración define los slots ocupados.
// ═════════════════════════════════════════════════════════

export default function ServiciosPage() {
  const { data: services, loading, refresh } = useApi<ServiceDTO[]>("/api/services?all=1");
  const { data: settings } = useApi<SettingsDTO>("/api/settings");
  const [editing, setEditing] = useState<ServiceDTO | null>(null);
  const [creating, setCreating] = useState(false);

  async function toggleActive(s: ServiceDTO) {
    await apiFetch(`/api/services/${s.id}`, {
      method: "PATCH",
      json: { active: !s.active },
    });
    void refresh();
  }

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Servicios</h1>
          <p className="text-sm text-muted">Lo que los clientes pueden reservar</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Agregar</Button>
      </header>

      {loading && <Spinner label="Cargando..." />}
      {!loading && services?.length === 0 && (
        <EmptyState title="Sin servicios" hint="Creá tu primer servicio para empezar a recibir turnos." />
      )}

      <ul className="grid gap-2.5">
        {services?.map((s) => (
          <li key={s.id} className="flex items-center gap-4 rounded-card border border-line bg-surface p-4">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                ✂️ {s.name}
                {!s.active && (
                  <span className="rounded-full border border-danger/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger">
                    Oculto
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted">
                {formatMoney(s.price, settings?.currency)} · {s.durationMin} minutos ({Math.ceil(s.durationMin / 15)} slots)
              </p>
              {s.description && (
                <p className="mt-1 line-clamp-1 text-xs text-muted/70">{s.description}</p>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => toggleActive(s)}>
              {s.active ? "Ocultar" : "Mostrar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
              Editar
            </Button>
          </li>
        ))}
      </ul>

      {(creating || editing) && (
        <ServiceFormModal
          service={editing}
          currency={settings?.currency}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); void refresh(); }}
        />
      )}
    </div>
  );
}

function ServiceFormModal({
  service,
  currency,
  onClose,
  onSaved,
}: {
  service?: ServiceDTO | null;
  currency?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(service);
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [price, setPrice] = useState(String(service?.price ?? ""));
  const [duration, setDuration] = useState(String(service?.durationMin ?? 30));
  const [imageUrl, setImageUrl] = useState(service?.imageUrl ?? "");
  const [sortOrder, setSortOrder] = useState(String(service?.sortOrder ?? 0));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // vista previa del precio formateado mientras tipea
  const preview = Number(price) > 0 ? formatMoney(Number(price), currency) : "—";

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        name,
        description: description || null,
        price: Math.round(Number(price)),
        durationMin: Math.round(Number(duration)),
        imageUrl: imageUrl || null,
        sortOrder: Number(sortOrder) || 0,
      };
      if (isEdit && service) {
        await apiFetch(`/api/services/${service.id}`, { method: "PATCH", json: payload });
      } else {
        await apiFetch("/api/services", { method: "POST", json: payload });
      }
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const valid = name.trim().length >= 2 && Number(price) >= 0 && price !== "" && Number(duration) >= 5;

  return (
    <Modal open onClose={onClose} title={isEdit ? `Editar ${service!.name}` : "Nuevo servicio"}>
      <div className="grid gap-3.5">
        <Field label="Nombre" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Corte + Barba" maxLength={60} />
        </Field>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label={`Precio${currency ? ` (${currency})` : ""}`} required hint={preview}>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" inputMode="numeric" min={0} placeholder="26000" />
          </Field>
          <Field label="Duración (minutos)" required>
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} type="number" inputMode="numeric" min={5} step={5} placeholder="30" />
          </Field>
        </div>
        <Field label="Descripción">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué incluye (opcional)" maxLength={300} rows={2} />
        </Field>
        <div className="grid grid-cols-[1fr_100px] gap-3.5">
          <Field label="Imagen (URL)">
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" type="url" />
          </Field>
          <Field label="Orden">
            <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" min={0} max={999} />
          </Field>
        </div>
        {err && <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!valid || busy} loading={busy}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
