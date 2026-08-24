// Diagnóstico: flujo completo gestion-por-código contra el server vivo.
const BASE = "http://localhost:3000";

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.data != null, json };
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const date = tomorrow();
console.log("fecha:", date);

const svcs = await api("GET", "/api/services");
const corte = svcs.json.data.find((s) => s.name.includes("Corte") && !s.name.includes("Barba")) ?? svcs.json.data[0];
console.log("servicio:", corte.id, corte.name);

const av1 = await api("GET", `/api/availability?serviceId=${corte.id}&date=${date}&barberId=any`);
const slots = av1.json.data.slots;
console.log("slots libres:", slots.length, "| primeros:", slots.slice(0, 4).map((s) => s.time).join(", "));
if (slots.length < 3) throw new Error("no hay suficientes slots");

const original = slots[0];
const target = slots[2];

// 1) reservar
const created = await api("POST", "/api/appointments", {
  serviceId: corte.id,
  barberId: "any",
  date,
  startMin: original.minute,
  customerName: "Repro Test",
  customerPhone: "5491100009999",
});
const code = created.json.data.code;
console.log("\ncreado:", code, "en", created.json.data.startTime, "(startMin", created.json.data.startMin + ")");

// 2) GET inicial
let pub = await api("GET", `/api/manage/${code}`);
console.log("GET #1 ->", pub.json.data.startTime);

// 3) reprogramar
const resch = await api("PUT", `/api/manage/${code}`, {
  phone: "5491100009999",
  date,
  startMin: target.minute,
});
console.log(`PUT reprogramar a ${target.time} -> status ${resch.status}, data.startTime:`, resch.json?.data?.startTime, "startMin:", resch.json?.data?.startMin);

// 4) GET después
pub = await api("GET", `/api/manage/${code}`);
console.log("GET #2 ->", pub.json.data.startTime);
console.log("\nRESULTADO:", pub.json.data.startTime === target.time ? "CONSISTENTE ✓" : `MISMATCH ✗ (esperaba ${target.time})`);

// 5) limpiar: cancelar
await api("POST", `/api/manage/${code}/cancel`, { phone: "5491100009999" });
console.log("(limpieza: turno cancelado)");
