type ValidationSummaryProps = {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  warnings?: string[];
};

export default function ValidationSummary({
  total,
  valid,
  invalid,
  duplicate,
  warnings = [],
}: ValidationSummaryProps) {
  const validPct = total ? Math.round((valid / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">
          Validation Summary
        </h3>
        <span className="text-xs text-[var(--muted)]">{total} rows</span>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full bg-[var(--accent-strong)]"
          style={{ width: `${validPct}%` }}
        />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-[var(--muted)]">Valid</p>
          <p className="text-emerald-300">{valid}</p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Invalid</p>
          <p className="text-rose-300">{invalid}</p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Duplicates</p>
          <p className="text-amber-300">{duplicate}</p>
        </div>
      </div>
      {warnings.length ? (
        <div className="mt-4 space-y-1 text-xs text-amber-200">
          {warnings.map((warning) => (
            <p key={warning}>• {warning}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
