import type { RowIssue } from "@/lib/cleaner";

type RowDiffProps = {
  issues: RowIssue[];
};

export default function RowDiff({ issues }: RowDiffProps) {
  const fixedIssues = issues.filter((i) => i.severity === "fixed");
  if (fixedIssues.length === 0) return null;

  return (
    <div className="space-y-1">
      {fixedIssues.map((issue, idx) => (
        <div key={idx} className="flex items-center gap-1.5 text-xs">
          <span className="font-medium text-blue-300">{issue.field}:</span>
          <span className="text-rose-300/70 line-through">
            {formatValue(issue.originalValue)}
          </span>
          <span className="text-[var(--muted)]">→</span>
          <span className="text-emerald-300">
            {formatValue(issue.cleanedValue)}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "∅";
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}
