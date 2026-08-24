"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/agenda", label: "Agenda", icon: "🗓" },
  { href: "/admin/turnos", label: "Turnos", icon: "🎫" },
  { href: "/admin/barberos", label: "Barberos", icon: "💈" },
  { href: "/admin/servicios", label: "Servicios", icon: "✂️" },
  { href: "/admin/clientes", label: "Clientes", icon: "👥" },
  { href: "/admin/horarios", label: "Horarios", icon: "⏰" },
  { href: "/admin/bloqueos", label: "Bloqueos", icon: "🚫" },
  { href: "/admin/configuracion", label: "Configuración", icon: "⚙️" },
];

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-accent/15 text-accent"
                : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Topbar mobile */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur-md lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="rounded-lg p-2 text-xl leading-none"
        >
          ☰
        </button>
        <span className="text-sm font-extrabold tracking-widest">BARBERS</span>
        <span className="w-9" />
      </div>

      {/* Drawer mobile */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        >
          <aside
            className="flex h-full w-64 flex-col border-r border-line bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarHeader userName={userName} onLogout={logout} />
            {nav}
          </aside>
        </div>
      )}

      {/* Sidebar fijo desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <SidebarHeader userName={userName} onLogout={logout} />
        {nav}
        <Link
          href="/"
          className="m-3 rounded-xl border border-line px-3.5 py-2.5 text-center text-xs text-muted transition hover:text-ink"
        >
          ← Ver sitio público
        </Link>
      </aside>
    </>
  );
}

function SidebarHeader({
  userName,
  onLogout,
}: {
  userName: string;
  onLogout: () => void;
}) {
  return (
    <div className="border-b border-line p-4">
      <p className="flex items-center gap-2 font-extrabold tracking-widest">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink">
          ✂
        </span>
        BARBERS
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className="truncate text-xs text-muted">👤 {userName}</span>
        <button
          onClick={onLogout}
          className="text-xs text-muted transition hover:text-danger"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
