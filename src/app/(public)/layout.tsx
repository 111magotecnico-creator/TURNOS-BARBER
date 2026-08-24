import Link from "next/link";
import { getSettings } from "@/services/settings.service";

export const dynamic = "force-dynamic";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-lg text-accent-ink">
              ✂
            </span>
            <span className="text-sm font-extrabold tracking-[0.18em] sm:text-base">
              {settings.shopName}
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted sm:flex">
            <a href="/#servicios" className="transition hover:text-ink">Servicios</a>
            <a href="/#barberos" className="transition hover:text-ink">Barberos</a>
            <a href="/#info" className="transition hover:text-ink">Ubicación</a>
          </nav>
          <Link
            href="/reservar"
            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink transition hover:bg-accent-strong sm:text-sm"
          >
            RESERVAR
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer id="info" className="border-t border-line py-6 sm:py-10">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 text-sm sm:grid-cols-3 sm:gap-8">
          <div>
            <p className="mb-2 font-bold tracking-widest">{settings.shopName}</p>
            <p className="text-muted">{settings.address}</p>
          </div>
          <div>
            <p className="mb-2 font-bold tracking-wide">Contacto</p>
            <p className="text-muted">{settings.phone}</p>
            {settings.whatsapp && (
              <a
                href={`https://wa.me/${settings.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-accent hover:underline"
              >
                WhatsApp →
              </a>
            )}
            {settings.instagram && (
              <p className="mt-1 text-muted">@{settings.instagram}</p>
            )}
          </div>
          <div>
            <p className="mb-2 font-bold tracking-wide">Turnos</p>
            <p className="text-muted">
              Reservá online 24/7.
              <br />
              Gestioná tu turno desde el link de confirmación.
            </p>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-muted/60">
          © {new Date().getFullYear()} {settings.shopName} · Sistema de turnos online
        </p>
      </footer>

      {/* CTA fijo mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 p-3 backdrop-blur-md sm:hidden">
        <Link
          href="/reservar"
          className="block w-full rounded-xl bg-accent py-3.5 text-center text-sm font-bold tracking-wide text-accent-ink"
        >
          RESERVAR TURNO
        </Link>
      </div>
    </div>
  );
}
