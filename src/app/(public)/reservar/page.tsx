import type { Metadata } from "next";
import { BookingWizard } from "@/components/public/BookingWizard";

export const metadata: Metadata = {
  title: "Reservar turno · BARBERS",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function ReservarPage() {
  return (
    <div className="mx-auto max-w-2xl overflow-hidden px-3 py-4 sm:px-4 sm:py-10">
      <header className="mb-4 text-center sm:mb-8">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Reservá tu turno</h1>
        <p className="mt-1 text-xs text-muted sm:mt-1.5 sm:text-sm">
          6 pasos, menos de un minuto. Sin cuenta, sin llamadas.
        </p>
      </header>
      <BookingWizard />
    </div>
  );
}
