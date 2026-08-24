import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/admin/Sidebar";

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  return (
    <div className="min-h-screen">
      <Sidebar userName={session.name} />
      {/* Contenido con margen para el sidebar fijo en desktop */}
      <div className="lg:pl-64">
        <main className="mx-auto max-w-5xl px-4 py-6 pb-20">{children}</main>
      </div>
    </div>
  );
}
