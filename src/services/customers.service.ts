import { prisma } from "@/lib/db";

// ═════════════════════════════════════════════════════════
// Clientes: directorio agregado automáticamente por teléfono.
// Cada reserva hace upsert → la agenda construye la base de
// clientes sola, sin que nadie cargue nada a mano.
// ═════════════════════════════════════════════════════════

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  blocked: boolean;
  visits: number;
  lastVisit: string | null;
}

export async function listCustomers(q?: string): Promise<CustomerListItem[]> {
  const term = q?.trim();
  const where = term
    ? {
        OR: [
          { name: { contains: term } },
          { phone: { contains: term.replace(/\D/g, "") } },
        ],
      }
    : undefined;

  const [customers, stats] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.appointment.groupBy({
      by: ["customerId"],
      where: {
        status: { not: "CANCELLED" },
        customerId: { not: null },
      },
      _count: { _all: true },
      _max: { date: true },
    }),
  ]);

  const statMap = new Map(
    stats.map((s) => [s.customerId, { count: s._count._all, last: s._max.date }])
  );

  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    blocked: c.blocked,
    visits: statMap.get(c.id)?.count ?? 0,
    lastVisit: statMap.get(c.id)?.last ?? null,
  }));
}
