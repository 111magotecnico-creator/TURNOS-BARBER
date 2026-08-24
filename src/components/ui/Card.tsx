export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-line bg-surface p-4 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}
