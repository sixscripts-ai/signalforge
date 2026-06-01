type StatusBadgeProps = {
  status: string;
};

const STATUS_STYLES: Record<string, string> = {
  imported: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  validated: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]",
  parsing: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]",
  pending: "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  valid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  invalid: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  duplicate: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const classes = STATUS_STYLES[normalized] ??
    "border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted)]";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-[0.1em] ${classes}`}
    >
      {normalized}
    </span>
  );
}
