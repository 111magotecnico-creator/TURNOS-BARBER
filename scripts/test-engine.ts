/**
 * Tests del motor de disponibilidad.
 * Ejecutar: npm run test:engine
 */
import { computeSlots, filterSlotsWithCapacity } from "../src/lib/availability/engine";
import type { BarberDayInput } from "../src/types";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FALLO: ${msg}`);
  }
}

function barber(partial: Partial<BarberDayInput>): BarberDayInput {
  return {
    barberId: "b1",
    workingIntervals: [],
    busy: [],
    blocked: [],
    isDayOff: false,
    ...partial,
  };
}

const times = (slots: { time: string }[]) => slots.map((s) => s.time);

console.log("\n═ ESCENARIO 1: Juan 09-18, servicio 60min, turno 09:00-10:00 ocupado");
{
  const slots = computeSlots({
    barbers: [
      barber({
        workingIntervals: [{ start: 540, end: 1080 }], // 09:00-18:00
        busy: [{ start: 540, end: 600 }], // 09:00-10:00
      }),
    ],
    durationMin: 60,
    slotStepMin: 60,
  });
  const t = times(slots);
  assert(!t.includes("09:00"), "NO ofrece 09:00 (ocupado)");
  assert(t[0] === "10:00", "primer slot es 10:00");
  assert(t[t.length - 1] === "17:00", "último slot es 17:00 (18:00 no entra el servicio)");
  assert(t.length === 8, `exactamente 8 slots (hay ${t.length})`);
}

console.log("\n═ ESCENARIO 2: servicio de 50min con step 15 → alineación correcta");
{
  const slots = computeSlots({
    barbers: [
      barber({ workingIntervals: [{ start: 540, end: 600 }] }), // 09:00-10:00
    ],
    durationMin: 50,
    slotStepMin: 15,
  });
  // Entran: 09:00 (→09:50) y 09:10? no: step alinea a :00,:15,:30,:45
  // válidos: 09:00 y... 09:15+50=10:05 > 10:00 ✗. Solo 09:00.
  assert(times(slots).join() === "09:00", `solo existe 09:00 (hay: ${times(slots)})`);
}

console.log("\n═ ESCENARIO 3: día libre → sin horarios");
{
  const slots = computeSlots({
    barbers: [
      barber({ isDayOff: true, workingIntervals: [{ start: 0, end: 1440 }] }),
    ],
    durationMin: 30,
    slotStepMin: 30,
  });
  assert(slots.length === 0, "día libre = 0 slots");
}

console.log("\n═ ESCENARIO 4: bloqueo de almuerzo 13:00-14:00");
{
  const slots = computeSlots({
    barbers: [
      barber({
        workingIntervals: [{ start: 540, end: 1080 }], // continua
        blocked: [{ start: 780, end: 840 }], // almuerzo
      }),
    ],
    durationMin: 60,
    slotStepMin: 15,
  });
  const t = times(slots);
  assert(t.includes("12:00"), "12:00 válido (termina justo al iniciar almuerzo)");
  assert(!t.includes("12:15"), "12:15 bloqueado (cruzaría el almuerzo)");
  assert(!t.includes("12:30"), "12:30 bloqueado");
  assert(!t.includes("12:45"), "12:45 bloqueado");
  assert(t.includes("14:00"), "14:00 disponible tras almuerzo");
}

console.log("\n═ ESCENARIO 5: hora actual — hoy solo desde minStart");
{
  const slots = computeSlots({
    barbers: [barber({ workingIntervals: [{ start: 540, end: 1080 }] })],
    durationMin: 30,
    slotStepMin: 30,
    minStart: 660, // 11:00
  });
  assert(times(slots)[0] === "11:00", "primer slot >= 11:00");
}

console.log("\n═ ESCENARIO 6: dos turnos consecutivos sin gap (back-to-back)");
{
  const slots = computeSlots({
    barbers: [
      barber({
        workingIntervals: [{ start: 540, end: 720 }], // 09:00-12:00
        busy: [
          { start: 540, end: 600 }, // 09:00-10:00
          { start: 600, end: 660 }, // 10:00-11:00
        ],
      }),
    ],
    durationMin: 60,
    slotStepMin: 15,
  });
  assert(
    times(slots).join() === "11:00",
    `único hueco 11:00 (hay: ${times(slots)})`,
  );
}

console.log("\n═ ESCENARIO 7: 'Cualquier barbero' — intersección de 2 barberos");
{
  const slots = computeSlots({
    barbers: [
      barber({
        barberId: "martin",
        workingIntervals: [{ start: 540, end: 720 }],
      }),
      barber({
        barberId: "lucas",
        workingIntervals: [{ start: 600, end: 720 }], // empieza 10:00
        busy: [{ start: 660, end: 720 }], // 11:00-12:00 ocupado
      }),
    ],
    durationMin: 60,
    slotStepMin: 60,
  });
  const s10 = slots.find((s) => s.time === "10:00");
  const s11 = slots.find((s) => s.time === "11:00");
  assert(s10?.barberIds.join() === "martin,lucas", "10:00 libre para ambos");
  assert(s11?.barberIds.join() === "martin", "11:00 solo Martín");
}

console.log("\n═ ESCENARIO 8: filterSlotsWithCapacity");
{
  const slots = computeSlots({
    barbers: [
      barber({ barberId: "a", workingIntervals: [{ start: 540, end: 600 }] }),
      barber({ barberId: "b", workingIntervals: [{ start: 570, end: 600 }] }),
    ],
    durationMin: 30,
    slotStepMin: 30,
  });
  const two = filterSlotsWithCapacity(slots, 2);
  assert(
    two.length === 1 && two[0].time === "09:30",
    `único slot con capacidad 2 es 09:30 (hay: ${times(two)})`,
  );
}

console.log("\n═ ESCENARIO 9: superposición parcial NO permitida");
{
  const slots = computeSlots({
    barbers: [
      barber({
        workingIntervals: [{ start: 540, end: 720 }],
        busy: [{ start: 555, end: 585 }], // 09:15-09:25
      }),
    ],
    durationMin: 30,
    slotStepMin: 15,
  });
  const t = times(slots);
  assert(!t.includes("09:00"), "09:00 bloqueado (terminaría dentro del turno)");
  assert(!t.includes("09:15"), "09:15 bloqueado");
  assert(!t.includes("09:30"), "09:30 bloqueado (se superpone parcialmente)");
  assert(t[0] === "09:45", `primer slot libre es 09:45 (hay: ${t[0]})`);
}

console.log(`\n════════════════════════════════════`);
if (failed === 0) {
  console.log(`✔ TODOS LOS TESTS PASARON (${passed}/${passed + failed})\n`);
  process.exit(0);
} else {
  console.error(`✘ ${failed} TESTS FALLARON de ${passed + failed}\n`);
  process.exit(1);
}
