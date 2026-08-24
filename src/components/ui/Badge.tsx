const styles: Record<string, string> = {
  CONFIRMED: "bg-accent/15 text-accent border-accent/30",
  COMPLETED: "bg-success/15 text-success border-success/30",
  CANCELLED: "bg-danger/15 text-danger border-danger/30",
};

export function Badge({
  status,
  label,
}: {
  status?: string;
  label?: string;
}) {
  const cls = (status && styles[status]) || "border-line text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${cls}`}
    >
      {label ?? status}
    </span>
  );
}
