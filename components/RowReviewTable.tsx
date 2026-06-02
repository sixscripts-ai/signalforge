'use client';

import { useState } from "react";
import type { ProcessedRow } from "@/lib/pipeline";
import RowDiff from "./RowDiff";
import { generateRejectedCsv } from "@/lib/export-rejected";

type StatusFilter = "all" | "valid" | "auto_fixed" | "needs_review" | "rejected" | "duplicate";

const filters: { key: StatusFilter; label: string; color: string }[] = [
  { key: "all", label: "All", color: "text-[var(--text)]" },
  { key: "valid", label: "Valid", color: "text-emerald-300" },
  { key: "auto_fixed", label: "Auto-fixed", color: "text-blue-300" },
  { key: "needs_review", label: "Needs Review", color: "text-amber-300" },
  { key: "rejected", label: "Rejected", color: "text-rose-300" },
  { key: "duplicate", label: "Duplicates", color: "text-slate-300" },
];

const statusBadgeClasses: Record<ProcessedRow["status"], string> = {
  valid: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  auto_fixed: "border-blue-500/40 text-blue-300 bg-blue-500/10",
  needs_review: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  rejected: "border-rose-500/40 text-rose-300 bg-rose-500/10",
  duplicate: "border-slate-500/40 text-slate-300 bg-slate-500/10",
};

const statusLabels: Record<ProcessedRow["status"], string> = {
  valid: "Valid",
  auto_fixed: "Auto-fixed",
  needs_review: "Review",
  rejected: "Rejected",
  duplicate: "Duplicate",
};

type RowReviewTableProps = {
  rows: ProcessedRow[];
};

export default function RowReviewTable({ rows }: RowReviewTableProps) {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const filtered = activeFilter === "all"
    ? rows
    : rows.filter((r) => r.status === activeFilter);

  const handleDownloadRejected = () => {
    const csv = generateRejectedCsv(rows);
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rejected-rows.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const rejectedCount = rows.filter((r) => r.status === "rejected").length;

  return (
    <div className="space-y-4">
      {/* Filter pills + download button */}
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => {
          const count = f.key === "all" ? rows.length : rows.filter((r) => r.status === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                activeFilter === f.key
                  ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}

        {rejectedCount > 0 && (
          <button
            onClick={handleDownloadRejected}
            className="ml-auto rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 transition hover:bg-rose-500/20"
          >
            ↓ Download Rejected CSV
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border)] text-sm">
            <thead className="bg-[var(--panel-soft)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-16">Row</th>
                <th className="px-4 py-3 text-left font-medium w-28">Status</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Company</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Issues</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                    No rows match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const isExpanded = expandedRow === row.rowIndex;
                  const hasDetails = row.issues.length > 0 || row.validationErrors.length > 0;

                  return (
                    <tr
                      key={row.rowIndex}
                      className={`hover:bg-white/5 cursor-pointer transition ${
                        isExpanded ? "bg-white/5" : ""
                      }`}
                      onClick={() => setExpandedRow(isExpanded ? null : row.rowIndex)}
                    >
                      <td className="px-4 py-3 text-[var(--muted)] align-top">{row.rowIndex}</td>
                      <td className="px-4 py-3 align-top">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${statusBadgeClasses[row.status]}`}>
                          {statusLabels[row.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text)] align-top font-mono text-xs">
                        {String(row.cleaned.email ?? "-")}
                      </td>
                      <td className="px-4 py-3 text-[var(--text)] align-top">
                        {String(row.cleaned.name ?? "-")}
                      </td>
                      <td className="px-4 py-3 text-[var(--text)] align-top">
                        {String(row.cleaned.company ?? "-")}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--text)] align-top">
                        {row.cleaned.amount != null ? String(row.cleaned.amount) : "-"}
                      </td>
                      <td className="px-4 py-3 align-top max-w-xs">
                        {/* Inline issue summary */}
                        {row.status === "rejected" && row.validationErrors.length > 0 && (
                          <div className="space-y-0.5">
                            {row.validationErrors.map((err, i) => (
                              <p key={i} className="text-xs text-rose-300">
                                {err.field}: {err.message}
                              </p>
                            ))}
                          </div>
                        )}
                        {(row.status === "auto_fixed" || row.status === "needs_review") && row.issues.length > 0 && (
                          <div>
                            {isExpanded ? (
                              <RowDiff issues={row.issues} />
                            ) : (
                              <p className="text-xs text-blue-300">
                                {row.issues.length} fix{row.issues.length !== 1 ? "es" : ""} applied — click to expand
                              </p>
                            )}
                          </div>
                        )}
                        {row.status === "duplicate" && (
                          <p className="text-xs text-slate-300">Duplicate of another row</p>
                        )}
                        {row.status === "valid" && hasDetails && (
                          <p className="text-xs text-[var(--muted)]">—</p>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
