"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { EmptyState, Spinner } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/client";
import type { BarberDTO } from "@/types";

// ═════════════════════════════════════════════════════════
// BARBEROS — alta/baja/edición. Desactivar NO borra: conserva
// historial de turnos y solo lo saca de la web y la agenda.
// ═════════════════════════════════════════════════════════

export default function BarberosPage() {
  const { data: barbers, loading, refresh } = useApi<BarberDTO[]>("/api/barbers?all=1");
  const [editing, setEditing] = useState<BarberDTO | null>(null);
  const [creating, setCreating] = useState(false);

  async function toggleActive(b: BarberDTO) {
    await apiFetch(`/api/barbers/${b.id}`, {
      method: "PATCH",
      json: { active: !b.active },
    });
    void refresh();
  }

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Barberos</h1>
          <p className="text-sm text-muted">El equipo que atiende en la web</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Agregar</Button>
      </header>

      {loading && <Spinner label="Cargando..." />}
      {!loading && barbers?.length === 0 && (
        <EmptyState title="No hay barberos" hint="Agregá al menos uno para poder recibir reservas." />
      )}

      <ul className="grid gap-2.5">
        {barbers?.map((b) => (
          <li key={b.id} className="flex items-center gap-4 rounded-card border border-line bg-surface p-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-extrabold ${b.active ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"}`}>
              {b.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-semibold">
                {b.name}
                {!b.active && (
                  <span className="rounded-full border border-danger/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger">
                    Inactivo
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted">{b.specialty ?? "Barbero"}</p>
            </div>
            <Link href={`/admin/horarios?barberId=${b.id}`} className="hidden rounded-xl border border-line px-3 py-1.5 text-xs text-muted transition hover:text-accent sm:block">
              ⏰ Horarios
            </Link>
            <Button size="sm" variant="ghost" onClick={() => toggleActive(b)}>
              {b.active ? "Desactivar" : "Activar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
              Editar
            </Button>
          </li>
        ))}
      </ul>

      {(creating || editing) && (
        <BarberFormModal
          barber={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); void refresh(); }}
        />
      )}
    </div>
  );
}

function BarberFormModal({
  barber,
  onClose,
  onSaved,
}: {
  barber?: BarberDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(barber);
  const [name, setName] = useState(barber?.name ?? "");
  const [specialty, setSpecialty] = useState(barber?.specialty ?? "");
  const [description, setDescription] = useState(barber?.description ?? "");
  const [photoUrl, setPhotoUrl] = useState(barber?.photoUrl ?? "");
  const [sortOrder, setSortOrder] = useState(String(barber?.sortOrder ?? 0));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        name,
        specialty: specialty || null,
        description: description || null,
        photoUrl: photoUrl || null,
        sortOrder: Number(sortOrder) || 0,
      };
      if (isEdit && barber) {
        await apiFetch(`/api/barbers/${barber.id}`, { method: "PATCH", json: payload });
      } else {
        await apiFetch("/api/barbers", { method: "POST", json: payload });
      }
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? `Editar ${barber!.name}` : "Nuevo barbero"}>
      <div className="grid gap-3.5">
        <Field label="Nombre" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Martín" />
        </Field>
        <Field label="Especialidad" hint="Se muestra bajo el nombre en la web">
          <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ej: Fade & diseños" maxLength={80} />
        </Field>
        <Field label="Descripción">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Presentación corta (opcional)" maxLength={400} rows={3} />
        </Field>
        <Field label="Foto (URL)">
          <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" type="url" />
        </Field>
        <Field label="Orden de aparición">
          <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" min={0} max={999} />
        </Field>
        {err && <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy || name.trim().length < 2} loading={busy}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
