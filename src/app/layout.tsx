import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BARBER STUDIO · Reservá tu turno online",
  description:
    "Reservá tu turno en BARBER STUDIO 24/7. Elegí servicio, barbero, fecha y horario en segundos.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
