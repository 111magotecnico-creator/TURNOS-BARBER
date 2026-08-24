// Reproduce exactamente la assertion 8d del smoke suite.
const BASE = "http://localhost:3000/api";
const api = async (m, p, b) => {
  const r = await fetch(BASE + p, {
    method: m,
    headers: b ? { "Content-Type": "application/json" } : undefined,
    body: b ? JSON.stringify(b) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};

const date = "2026-08-24";
const services = (await api("GET", "/services")).json.data;
const corte = services.find((s) => s.name === "Corte");

const av1 = (await api("GET", `/availability?serviceId=${corte.id}&date=${date}`)).json.data;
console.log("slots con 09:15?", av1.slots.some((s) => s.minute === 555));
console.log("primeros slots:", av1.slots.slice(0, 6).map((s) => `${s.time}(${s.barberIds.length})`).join(" "));

// reservar 09:15 con any
const b = await api("POST", "/appointments", {
  serviceId: corte.id,
  barberId: "any",
  date,
  startMin: 555,
  customerName: "Debug Test",
  customerPhone: "5491100011111",
});
console.log("\nreserva 09:15 ->", b.status, b.json.data?.code, "barbero:", b.json.data?.barber?.name);

const av2 = (await api("GET", `/availability?serviceId=${corte.id}&date=${date}`)).json.data;
console.log("09:15 sigue ofrecido?", av2.slots.some((s) => s.minute === 555));

// cancelar por codigo
const c = await api("POST", `/manage/${b.json.data.code}/cancel`, { phone: "5491100011111" });
console.log("cancelar ->", c.status);

const av3 = (await api("GET", `/availability?serviceId=${corte.id}&date=${date}`)).json.data;
console.log("09:15 vuelto a ofrecer?", av3.slots.some((s) => s.minute === 555), "| total slots:", av3.slots.length);
