import type { Metadata } from "next";
import { BookingWizard } from "@/components/public/BookingWizard";

export const metadata: Metadata = {
  title: "Reservar turno · BARBERS",
};

export default function ReservarPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold">Reservá tu turno</h1>
        <p className="mt-1.5 text-sm text-muted">
          6 pasos, menos de un minuto. Sin cuenta, sin llamadas.
        </p>
      </header>
      <BookingWizard />
    </div>
  );
}
