"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/client";
import type { SettingsDTO } from "@/types";

// ═════════════════════════════════════════════════════════
// CONFIGURACIÓN — datos del local + reglas de agenda.
// Un solo registro en DB (id=1); los cambios impactan al
// instante en la web pública y el motor de disponibilidad.
// ═════════════════════════════════════════════════════════

const CURRENCIES = ["ARS", "USD", "MXN", "CLP", "COP", "BRL", "EUR"];
const PAYMENT_MODES: Record<string, string> = {
  ON_SITE: "Se abona en el local",
  FULL: "Pago completo online",
  DEPOSIT: "Seña online (depósito)",
};

export default function ConfiguracionPage() {
  const { data, loading } = useApi<SettingsDTO>("/api/settings");
  const [form, setForm] = useState<SettingsDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ── Reiniciar agenda ──
  const { data: resetData } = useApi<{ count: number }>("/api/admin/reset-agenda");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  if (loading || !form) return <Spinner label="Cargando configuración..." />;

  function set<K extends keyof SettingsDTO>(key: K, value: SettingsDTO[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setMsg(null);
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        json: {
          shopName: form.shopName,
          address: form.address,
          phone: form.phone,
          whatsapp: form.whatsapp.replace(/\D/g, ""),
          instagram: form.instagram ?? "",
          currency: form.currency,
          slotStepMin: Number(form.slotStepMin),
          bookingWindowDays: Number(form.bookingWindowDays),
          minLeadMin: Number(form.minLeadMin),
          depositEnabled: form.depositEnabled,
          depositPercent: Number(form.depositPercent),
          paymentMode: form.paymentMode,
        },
      });
      setMsg("Configuración guardada ✓");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resetAgenda() {
    setResetBusy(true);
    setResetError(null);
    setResetResult(null);
    try {
      const result = await apiFetch<{ message: string; appointments: number }>(
        "/api/admin/reset-agenda",
        { method: "POST", json: { confirm: "REINICIAR" } }
      );
      setResetResult(result.message);
      setShowResetModal(false);
      setResetConfirm("");
    } catch (e) {
      setResetError((e as Error).message);
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold">Configuración</h1>
        <p className="text-sm text-muted">Datos del local y reglas de la agenda</p>
      </header>

      <div className="grid gap-5">
        {/* Datos del local */}
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="mb-4 font-bold">🏪 Datos del local</h2>
          <div className="grid gap-3.5">
            <Field label="Nombre" required>
              <Input value={form.shopName} onChange={(e) => set("shopName", e.target.value)} maxLength={60} />
            </Field>
            <Field label="Dirección">
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={200} />
            </Field>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Teléfono">
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} />
              </Field>
              <Field label="WhatsApp" hint="Código país + número, solo dígitos">
                <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="5491155551234" inputMode="numeric" />
              </Field>
            </div>
            <Field label="Instagram (usuario)">
              <Input value={form.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)} placeholder="@barberstudio" maxLength={40} />
            </Field>
          </div>
        </section>

        {/* Reglas de agenda */}
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="mb-1 font-bold">⏱ Reglas de agenda</h2>
          <p className="mb-4 text-xs text-muted">Afectan cómo se generan los turnos disponibles</p>
          <div className="grid gap-3.5">
            <div className="grid grid-cols-3 gap-3.5">
              <Field label="Moneda">
                <select
                  value={form.currency}
                  onChange={(e) => set("currency", e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
                >
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Paso slots" hint="minutos">
                <Input type="number" min={5} max={120} step={5} value={form.slotStepMin} onChange={(e) => set("slotStepMin", Number(e.target.value))} />
              </Field>
              <Field label="Anticipación" hint="minutos mínimos">
                <Input type="number" min={0} max={1440} step={15} value={form.minLeadMin} onChange={(e) => set("minLeadMin", Number(e.target.value))} />
              </Field>
            </div>
            <Field label="Ventana de reserva" hint="Días hacia adelante que un cliente puede reservar">
              <Input type="number" min={1} max={365} value={form.bookingWindowDays} onChange={(e) => set("bookingWindowDays", Number(e.target.value))} />
            </Field>
          </div>
        </section>

        {/* Pagos */}
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="mb-1 font-bold">💳 Pagos</h2>
          <p className="mb-4 text-xs text-muted">
            Requiere MERCADOPAGO_ACCESS_TOKEN en .env para cobros online reales
          </p>
          <div className="grid gap-3.5">
            <Field label="Modo">
              <select
                value={form.paymentMode}
                onChange={(e) => set("paymentMode", e.target.value)}
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
              >
                {Object.entries(PAYMENT_MODES).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3">
              <span className="text-sm">Exigir seña para confirmar</span>
              <input
                type="checkbox"
                checked={form.depositEnabled}
                onChange={(e) => set("depositEnabled", e.target.checked)}
                className="h-4 w-4 accent-[#e8b44a]"
              />
            </label>
            {form.depositEnabled && (
              <Field label="Porcentaje de seña (%)">
                <Input type="number" min={0} max={100} value={form.depositPercent} onChange={(e) => set("depositPercent", Number(e.target.value))} />
              </Field>
            )}
          </div>
        </section>

        {/* Reiniciar agenda */}
        <section className="rounded-card border border-danger/30 bg-danger/5 p-5">
          <h2 className="mb-1 font-bold text-danger">⚠️ Reiniciar agenda</h2>
          <p className="mb-4 text-sm text-muted">
            Elimina todos los turnos, pagos y clientes registrados. Los barberos,
            servicios, horarios y configuración se conservan.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">
              Turnos actuales:{" "}
              <span className="font-bold text-ink">
                {resetData?.count ?? "…"}
              </span>
            </span>
            <Button
              variant="danger"
              onClick={() => {
                setShowResetModal(true);
                setResetConfirm("");
                setResetResult(null);
                setResetError(null);
              }}
              disabled={(resetData?.count ?? 0) === 0}
            >
              Reiniciar agenda
            </Button>
          </div>
          {(resetData?.count ?? 0) === 0 && !resetResult && (
            <p className="mt-2 text-xs text-muted">
              No hay turnos para eliminar. La agenda ya está vacía.
            </p>
          )}
          {resetResult && (
            <p className="mt-3 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
              {resetResult}
            </p>
          )}
        </section>

        {/* Modal de confirmación reset */}
        <Modal
          open={showResetModal}
          onClose={() => { if (!resetBusy) { setShowResetModal(false); setResetConfirm(""); } }}
          title="Reiniciar agenda"
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              <p className="font-bold">⚠️ Acción destructiva e irreversible</p>
              <p className="mt-1">
                Se eliminarán{" "}
                <strong>{resetData?.count} turnos</strong>, todos sus pagos
                asociados y los clientes registrados por esas reservas.
              </p>
              <p className="mt-1">
                Los barberos, servicios, horarios, bloqueos y configuración NO se
                eliminan.
              </p>
            </div>
            <Field
              label='Escribí REINICIAR para confirmar'
              required
            >
              <Input
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="REINICIAR"
                autoFocus
              />
            </Field>
            {resetError && (
              <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {resetError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => { setShowResetModal(false); setResetConfirm(""); }}
                disabled={resetBusy}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={resetAgenda}
                loading={resetBusy}
                disabled={resetConfirm !== "REINICIAR"}
              >
                Eliminar todos los turnos
              </Button>
            </div>
          </div>
        </Modal>

        {err && <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        {msg && <p className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">{msg}</p>}
        <div className="sticky bottom-20 flex justify-end lg:bottom-4">
          <Button size="lg" onClick={save} loading={busy}>Guardar cambios</Button>
        </div>
      </div>
    </div>
  );
}
