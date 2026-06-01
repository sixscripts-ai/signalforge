type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
};

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "border-[var(--border)]",
  accent: "border-[var(--accent-border)] shadow-[0_0_18px_rgba(56,189,248,0.12)]",
  success: "border-emerald-500/30",
  warning: "border-amber-500/30",
  danger: "border-rose-500/30",
};

export default function StatCard({ label, value, hint, tone = "neutral" }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border bg-[var(--panel-soft)] px-4 py-4 ${toneClasses[tone]}`}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-[var(--text)]">{value}</p>
      {hint ? <p className="mt-2 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}
