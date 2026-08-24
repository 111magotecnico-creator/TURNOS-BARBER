import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BARBERS · Reservá tu turno online",
  description:
    "Reservá tu turno en BARBERS 24/7. Elegí servicio, barbero, fecha y horario en segundos.",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen overflow-x-hidden bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
