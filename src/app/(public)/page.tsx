import Link from "next/link";
import { listServices } from "@/services/services.service";
import { listBarbers } from "@/services/barbers.service";
import { getSettings } from "@/services/settings.service";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function HomePage() {
  const [services, barbers, settings] = await Promise.all([
    listServices(),
    listBarbers(),
    getSettings(),
  ]);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-24">
          <p className="text-xs font-bold tracking-[0.35em] text-accent">
            {settings.shopName}
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-extrabold leading-tight sm:text-6xl">
            Tu turno,
            <br />
            <span className="text-accent">sin esperas.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-muted sm:text-lg">
            Elegí servicio, barbero y horario en menos de un minuto.
            Confirmación inmediata, sin llamadas ni cuentas.
          </p>
          <div className="mt-8 flex justify-center gap-3 pb-14 sm:pb-0">
            <Link
              href="/reservar"
              className="rounded-xl bg-accent px-8 py-4 text-sm font-bold tracking-wide text-accent-ink transition hover:bg-accent-strong active:scale-[.98]"
            >
              RESERVAR TURNO
            </Link>
            <a
              href="#servicios"
              className="hidden rounded-xl border border-line px-8 py-4 text-sm font-semibold transition hover:border-line-strong sm:block"
            >
              Ver servicios
            </a>
          </div>
        </div>
      </section>

      {/* SERVICIOS */}
      <section id="servicios" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-14">
        <h2 className="mb-1 text-2xl font-bold sm:text-3xl">Servicios</h2>
        <p className="mb-7 text-sm text-muted">
          Precios claros, duración real. Lo que ves es lo que reservás.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <div
              key={s.id}
              className="group rounded-card border border-line bg-surface p-5 transition hover:border-accent/40"
            >
              <h3 className="font-bold">{s.name}</h3>
              {s.description && (
                <p className="mt-1.5 line-clamp-2 min-h-10 text-xs leading-relaxed text-muted">
                  {s.description}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                <span className="text-xs font-medium text-muted">
                  ⏱ {s.durationMin} min
                </span>
                <span className="font-extrabold text-accent">
                  {formatMoney(s.price, settings.currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BARBEROS */}
      <section id="barberos" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-14">
        <h2 className="mb-1 text-2xl font-bold sm:text-3xl">Nuestros barberos</h2>
        <p className="mb-7 text-sm text-muted">
          O dejá que el sistema te asigne el primero disponible.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {barbers.map((b) => (
            <div
              key={b.id}
              className="flex items-start gap-4 rounded-card border border-line bg-surface p-5"
            >
              {b.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.photoUrl}
                  alt={b.name}
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-lg font-extrabold text-accent">
                  {initials(b.name)}
                </span>
              )}
              <div className="min-w-0">
                <h3 className="font-bold">{b.name}</h3>
                {b.specialty && (
                  <p className="text-xs font-medium text-accent">{b.specialty}</p>
                )}
                {b.description && (
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted">
                    {b.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-5xl px-4 pb-20 pt-6">
        <div className="relative overflow-hidden rounded-card border border-accent/25 bg-gradient-to-br from-surface to-surface-2 p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/15 blur-2xl" />
          <h2 className="text-2xl font-bold sm:text-3xl">
            ¿Listo para tu mejor look?
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Reservá ahora y recibí la confirmación al instante.
          </p>
          <Link
            href="/reservar"
            className="mt-6 inline-block rounded-xl bg-accent px-10 py-4 text-sm font-bold tracking-wide text-accent-ink transition hover:bg-accent-strong active:scale-[.98]"
          >
            RESERVAR AHORA
          </Link>
        </div>
      </section>
      <div className="h-16 sm:hidden" /> {/* espacio para CTA fijo */}
    </>
  );
}
