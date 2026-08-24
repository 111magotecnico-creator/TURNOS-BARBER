/**
 * Seed inicial — datos demo de BARBERS.
 * Ejecutar: npm run db:seed
 *
 * Idempotente: borra los datos demo antes de insertar.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDaysStr, todayStr, getWeekday } from "../src/lib/utils";

const prisma = new PrismaClient();

const WEEKDAY = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };

function wh(barberId: string, days: number[], startMin: number, endMin: number) {
  return days.map((weekday) => ({
    barberId,
    weekday,
    startMin,
    endMin,
    active: true,
  }));
}

async function main() {
  console.log("🌱 Seeding BARBERS...");

  // ── Limpieza (orden por dependencias) ──────────────────────
  await prisma.payment.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.blockedSlot.deleteMany();
  await prisma.dayOff.deleteMany();
  await prisma.workingHour.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.service.deleteMany();
  await prisma.barber.deleteMany();
  await prisma.user.deleteMany();
  await prisma.settings.deleteMany();

  // ── Configuración ──────────────────────────────────────────
  await prisma.settings.create({
    data: {
      id: "default",
      shopName: "BARBERS",
      address: "Av. Siempre Viva 742, Buenos Aires",
      phone: "+54 9 11 5555-1234",
      whatsapp: "5491155551234",
      instagram: "barberstudio",
      currency: "ARS",
      slotStepMin: 15,
      bookingWindowDays: 30,
      minLeadMin: 60,
      depositEnabled: false,
      depositPercent: 0,
      paymentMode: "ON_SITE",
    },
  });
  console.log("  ✓ Configuración de la barbería");

  // ── Admin ──────────────────────────────────────────────────
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  await prisma.user.create({
    data: {
      name: "Administrador",
      email: process.env.ADMIN_EMAIL ?? "admin@barberstudio.com",
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
    },
  });
  console.log(`  ✓ Usuario admin (${process.env.ADMIN_EMAIL ?? "admin@barberstudio.com"})`);

  // ── Barberos + horarios realistas ──────────────────────────
  const martin = await prisma.barber.create({
    data: {
      name: "Martín",
      specialty: "Cortes clásicos y degradados",
      description:
        "10 años de experiencia. Especialista en cortes clásicos, degradados a navaja y arreglos de barba con toalla caliente.",
      sortOrder: 0,
    },
  });
  const lucas = await prisma.barber.create({
    data: {
      name: "Lucas",
      specialty: "Estilos modernos y fades",
      description:
        "Experto en tendencias: textured crop, mid fade y diseños personalizados. Certificado en barbería internacional.",
      sortOrder: 1,
    },
  });
  const nico = await prisma.barber.create({
    data: {
      name: "Nico",
      specialty: "Barbas y perfilado",
      description:
        "El maestro de la barba: perfilado con navaja, afeitado clásico y tratamientos capilares.",
      sortOrder: 2,
    },
  });

  await prisma.workingHour.createMany({
    data: [
      // Martín: Lun-Vie 09-18, Sáb 09-14, Domingo libre
      ...wh(martin.id, [WEEKDAY.MON, WEEKDAY.TUE, WEEKDAY.WED, WEEKDAY.THU, WEEKDAY.FRI], 540, 1080),
      ...wh(martin.id, [WEEKDAY.SAT], 540, 840),
      // Lucas: Lun-Vie 10-19, Sáb 09-16, Domingo libre
      ...wh(lucas.id, [WEEKDAY.MON, WEEKDAY.TUE, WEEKDAY.WED, WEEKDAY.THU, WEEKDAY.FRI], 600, 1140),
      ...wh(lucas.id, [WEEKDAY.SAT], 540, 960),
      // Nico: Mar-Dom 11-20, Lunes libre
      ...wh(nico.id, [WEEKDAY.TUE, WEEKDAY.WED, WEEKDAY.THU, WEEKDAY.FRI], 660, 1200),
      ...wh(nico.id, [WEEKDAY.SAT, WEEKDAY.SUN], 600, 1140),
    ],
  });
  console.log("  ✓ Barberos: Martín, Lucas, Nico (+ horarios)");

  // ── Servicios ──────────────────────────────────────────────
  const corte = await prisma.service.create({
    data: {
      name: "Corte",
      description: "Corte a máquina y tijera según tu estilo, con lavado final.",
      price: 18000,
      durationMin: 30,
      sortOrder: 0,
    },
  });
  const corteBarba = await prisma.service.create({
    data: {
      name: "Corte + Barba",
      description: "Corte completo más arreglo y perfilado de barba con navaja.",
      price: 26000,
      durationMin: 50,
      sortOrder: 1,
    },
  });
  const barba = await prisma.service.create({
    data: {
      name: "Barba",
      description: "Perfilado, arreglo y tratamiento hidratante para tu barba.",
      price: 12000,
      durationMin: 20,
      sortOrder: 2,
    },
  });
  const premium = await prisma.service.create({
    data: {
      name: "Corte Premium",
      description: "Experiencia completa: consulta de estilo, corte, lavado, masaje capilar y styling.",
      price: 30000,
      durationMin: 60,
      sortOrder: 3,
    },
  });
  console.log("  ✓ Servicios: Corte, Corte+Barba, Barba, Corte Premium");

  // ── Turnos demo (hoy y mañana) ─────────────────────────────
  const today = todayStr();
  const tomorrow = addDaysStr(today, 1);

  async function demoAppointment(opts: {
    date: string;
    startMin: number;
    barberId: string;
    serviceId: string;
    duration: number;
    name: string;
    phone: string;
  }) {
    await prisma.customer.upsert({
      where: { phone: opts.phone },
      update: {},
      create: { phone: opts.phone, name: opts.name },
    });
    return prisma.appointment.create({
      data: {
        code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        date: opts.date,
        startMin: opts.startMin,
        endMin: opts.startMin + opts.duration,
        barberId: opts.barberId,
        serviceId: opts.serviceId,
        customerName: opts.name,
        customerPhone: opts.phone,
        source: "ADMIN",
      },
    });
  }

  await demoAppointment({ date: today, startMin: 600, barberId: martin.id, serviceId: corte.id, duration: 30, name: "Juan Pérez", phone: "5491111110001" });
  await demoAppointment({ date: today, startMin: 690, barberId: martin.id, serviceId: corteBarba.id, duration: 50, name: "Carlos Gómez", phone: "5491111110002" });
  await demoAppointment({ date: today, startMin: 630, barberId: lucas.id, serviceId: premium.id, duration: 60, name: "Diego Fernández", phone: "5491111110003" });
  await demoAppointment({ date: tomorrow, startMin: 570, barberId: nico.id, serviceId: barba.id, duration: 20, name: "Martín Ruiz", phone: "5491111110004" });
  await demoAppointment({ date: tomorrow, startMin: 750, barberId: martin.id, serviceId: corte.id, duration: 30, name: "Leo Suárez", phone: "5491111110005" });
  console.log("  ✓ Turnos demo hoy y mañana");

  // Sanidad: verificar que el weekday de hoy tiene sentido
  console.log(`  ℹ Hoy es ${today} (weekday ${getWeekday(today)})`);

  console.log("\n✅ Seed completado.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
