import type { ImportSummary } from "@/lib/pipeline";

type PreviewSummaryProps = {
  summary: ImportSummary;
  warnings?: string[];
};

const segments = [
  { key: "valid", label: "Valid", color: "bg-emerald-400", textColor: "text-emerald-300" },
  { key: "autoFixed", label: "Auto-fixed", color: "bg-blue-400", textColor: "text-blue-300" },
  { key: "needsReview", label: "Needs Review", color: "bg-amber-400", textColor: "text-amber-300" },
  { key: "rejected", label: "Rejected", color: "bg-rose-400", textColor: "text-rose-300" },
  { key: "duplicate", label: "Duplicates", color: "bg-slate-500", textColor: "text-slate-300" },
] as const;

export default function PreviewSummary({ summary, warnings = [] }: PreviewSummaryProps) {
  const { total } = summary;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">Import Preview</h3>
        <span className="text-xs text-[var(--muted)]">{total} rows</span>
      </div>

      {/* Stacked progress bar */}
      <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-black/40">
        {segments.map((seg) => {
          const value = summary[seg.key as keyof ImportSummary] as number;
          const pct = total ? (value / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={seg.key}
              className={`h-full ${seg.color} transition-all duration-500`}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>

      {/* Metric grid */}
      <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 text-xs">
        {segments.map((seg) => {
          const value = summary[seg.key as keyof ImportSummary] as number;
          return (
            <div key={seg.key}>
              <p className="text-[var(--muted)]">{seg.label}</p>
              <p className={seg.textColor}>{value}</p>
            </div>
          );
        })}
        <div>
          <p className="text-[var(--muted)]">Ready to import</p>
          <p className="text-[var(--text)] font-semibold">{summary.importable}</p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="mt-4 space-y-1 text-xs text-amber-200">
          {warnings.map((warning) => (
            <p key={warning}>• {warning}</p>
          ))}
        </div>
      )}
    </div>
  );
}
