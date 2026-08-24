// Replica el flujo exacto de smoke-api.ps1 secciones 3-8 y muestra el error real.
const BASE = "http://localhost:3000/api";
const api = async (m, p, b) => {
  const r = await fetch(BASE + p, {
    method: m,
    headers: b ? { "Content-Type": "application/json" } : undefined,
    body: b ? JSON.stringify(b) : undefined,
  });
  const j = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok && j?.data != null, data: j?.data, err: j?.error?.message };
};

// misma lógica de fecha que el ps1: mañana salteando domingo
let date = null;
for (let i = 1; i <= 8; i++) {
  const d = new Date();
  d.setDate(d.getDate() + i);
  if (d.getDay() !== 0) { 
    const p = (n) => String(n).padStart(2, "0");
    date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; 
    break; 
  }
}
console.log("fecha:", date);

const services = (await api("GET", "/services")).data;
const corte = services.find((s) => s.name === "Corte");

const av = (await api("GET", `/availability?serviceId=${corte.id}&date=${date}`)).data;
const slot = av.slots.find((s) => s.barberIds.length >= 2);
console.log("slot elegido:", slot.time, "barberos libres:", slot.barberIds.length);

const booking = await api("POST", "/appointments", {
  serviceId: corte.id,
  barberId: "any",
  date,
  startMin: slot.minute,
  customerName: "Pedro Prueba",
  customerPhone: "+54 9 11 4444-9999",
  customerEmail: "",
});
console.log("reserva:", booking.status, booking.data.code, "->", booking.data.barber.name);
const assignedBarberId = booking.data.barber.id;

const b2 = await api("POST", "/appointments", {
  serviceId: corte.id,
  barberId: "any",
  date,
  startMin: slot.minute,
  customerName: "Ana Lopez",
  customerPhone: "555888111",
});
console.log("ana:", b2.status, "->", b2.data?.barber?.name);

const av2 = (await api("GET", `/availability?serviceId=${corte.id}&date=${date}`)).data;
const freeSlots = av2.slots.filter(
  (s) => s.minute !== slot.minute && s.barberIds.includes(assignedBarberId)
);
const newSlot = freeSlots[1];
console.log("\nnewSlot:", newSlot?.time, "(índice [1] de", freeSlots.length, "libres)");

const wrong = await api("PUT", `/manage/${booking.data.code}`, { phone: "000000000", date, startMin: newSlot.minute });
console.log("PUT teléfono incorrecto ->", wrong.status, wrong.err);

const resch = await api("PUT", `/manage/${booking.data.code}`, { phone: "+54 9 11 4444-9999", date, startMin: newSlot.minute });
console.log("PUT reprogramar ->", resch.status, resch.err ?? `ok startMin=${resch.data?.startMin}`);

// limpieza
if (resch.ok) await api("POST", `/manage/${booking.data.code}/cancel`, { phone: "5491144449999" });
else await api("POST", `/manage/${booking.data.code}/cancel`, { phone: "5491144449999" });
await api("POST", `/manage/${b2.data.code}/cancel`, { phone: "555888111" });
console.log("(limpieza hecha)");
