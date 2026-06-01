type AnalyticsCardProps = {
  title: string;
  value: string;
  description?: string;
};

export default function AnalyticsCard({
  title,
  value,
  description,
}: AnalyticsCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        {title}
      </p>
      <p className="mt-3 text-2xl font-semibold text-[var(--text)]">{value}</p>
      {description ? (
        <p className="mt-2 text-xs text-[var(--muted)]">{description}</p>
      ) : null}
    </div>
  );
}
