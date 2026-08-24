import { getSession } from "@/lib/auth";
import { getDashboardStats } from "@/services/stats.service";
import { minToTime, todayStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, session] = await Promise.all([getDashboardStats(), getSession()]);
  const today = todayStr();

  const cards = [
    { label: "Turnos de hoy", value: stats.today.total, accent: true },
    { label: "Confirmados", value: stats.today.confirmed },
    { label: "Completados", value: stats.today.completed },
    { label: "Cancelados", value: stats.today.cancelled, danger: true },
  ];

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold">
          Hola{session?.name ? `, ${session.name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="mt-0.5 text-sm text-muted">Resumen de {today}</p>
      </header>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-card border p-4 ${
              c.accent ? "border-accent/40 bg-accent/5" : "border-line bg-surface"
            }`}
          >
            <p className={`text-3xl font-extrabold ${c.danger ? "text-danger" : c.accent ? "text-accent" : ""}`}>
              {c.value}
            </p>
            <p className="mt-1 text-xs text-muted">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Ingresos estimados hoy</p>
          <p className="mt-1 text-xl font-extrabold text-success">
            ${stats.today.estimatedRevenue.toLocaleString("es-AR")}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Turnos no cancelados · {stats.currency}
          </p>
        </div>
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Semana / Mes</p>
          <p className="mt-1 text-sm">
            <span className="font-bold">{stats.week.confirmed}</span> turnos confirmados esta semana
          </p>
          <p className="mt-1 text-sm">
            <span className="font-bold text-danger">{stats.month.cancellations}</span> cancelaciones este mes
          </p>
          <p className="mt-1 text-sm">
            Ingresos del mes:{" "}
            <span className="font-bold text-success">
              ${stats.month.estimatedRevenue.toLocaleString("es-AR")}
            </span>
          </p>
        </div>
      </div>

      {/* Próximos turnos */}
      <h2 className="mb-3 mt-8 font-bold">Próximos turnos de hoy</h2>
      {stats.upcoming.length === 0 ? (
        <p className="rounded-card border border-dashed border-line py-10 text-center text-sm text-muted">
          No quedan turnos pendientes por hoy 🎉
        </p>
      ) : (
        <ul className="grid gap-2.5">
          {stats.upcoming.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-4 rounded-card border border-line bg-surface p-4"
            >
              <span className="w-14 shrink-0 text-lg font-extrabold text-accent">
                {minToTime(a.time)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{a.customerName}</p>
                <p className="text-xs text-muted">
                  {a.serviceName} · {a.barberName}
                </p>
              </div>
              <code className="rounded-lg bg-surface-2 px-2 py-1 text-[11px] text-muted">
                {a.code}
              </code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
