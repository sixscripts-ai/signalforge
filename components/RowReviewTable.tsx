'use client';

import { useState, useCallback } from "react";
import type { ProcessedRow } from "@/lib/pipeline";
import type { SchemaProfileConfig } from "@/lib/schema-profile";
import type { AiRepairSuggestion } from "@/lib/ai/repair";
import RowDiff from "./RowDiff";
import AiRepairPanel from "./AiRepairPanel";

type StatusFilter =
  | "all"
  | "valid"
  | "auto_fixed"
  | "needs_review"
  | "rejected"
  | "duplicate"
  | "ai_repaired";

const filters: { key: StatusFilter; label: string; color: string }[] = [
  { key: "all", label: "All", color: "text-[var(--text)]" },
  { key: "valid", label: "Valid", color: "text-emerald-300" },
  { key: "auto_fixed", label: "Auto-fixed", color: "text-blue-300" },
  { key: "ai_repaired", label: "AI Repaired", color: "text-violet-300" },
  { key: "needs_review", label: "Needs Review", color: "text-amber-300" },
  { key: "rejected", label: "Rejected", color: "text-rose-300" },
  { key: "duplicate", label: "Duplicates", color: "text-slate-300" },
];

const statusBadgeClasses: Record<ProcessedRow["status"], string> = {
  valid: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  auto_fixed: "border-blue-500/40 text-blue-300 bg-blue-500/10",
  ai_repaired: "border-violet-500/40 text-violet-300 bg-violet-500/10",
  needs_review: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  rejected: "border-rose-500/40 text-rose-300 bg-rose-500/10",
  duplicate: "border-slate-500/40 text-slate-300 bg-slate-500/10",
};

const statusLabels: Record<ProcessedRow["status"], string> = {
  valid: "Valid",
  auto_fixed: "Auto-fixed",
  ai_repaired: "AI Repaired",
  needs_review: "Review",
  rejected: "Rejected",
  duplicate: "Duplicate",
};

type RowReviewTableProps = {
  rows: ProcessedRow[];
  importJobId?: string;
  /** When provided, enables AI repair and row mutation */
  onRowsChange?: (rows: ProcessedRow[]) => void;
  /** Schema profile snapshot to use for AI repair */
  profileSnapshot?: SchemaProfileConfig;
};

export default function RowReviewTable({
  rows,
  importJobId,
  onRowsChange,
  profileSnapshot,
}: RowReviewTableProps) {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [batchRepairing, setBatchRepairing] = useState(false);

  const filtered =
    activeFilter === "all"
      ? rows
      : rows.filter((r) => r.status === activeFilter);

  const handleDownloadRejected = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch("/api/exports/rejected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, importJobId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed." }));
        console.error("Rejected-row export error:", err.error);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rejected-rows.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Rejected-row export error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleApplySuggestion = useCallback(
    (rowIndex: number, suggestion: AiRepairSuggestion) => {
      if (!onRowsChange) return;

      const updatedRows = rows.map((row) => {
        if (row.rowIndex !== rowIndex) return row;

        const cleaned = {
          ...row.cleaned,
          [suggestion.field]: suggestion.suggestedValue,
        };

        return {
          ...row,
          status: "ai_repaired" as const,
          cleaned,
          issues: [
            ...row.issues.filter((i) => i.field !== suggestion.field),
            {
              field: suggestion.field,
              severity: "fixed" as const,
              message: `AI repair: ${suggestion.reasoning}`,
              originalValue: suggestion.currentValue,
              cleanedValue: suggestion.suggestedValue,
            },
          ],
        };
      });

      onRowsChange(updatedRows);
    },
    [rows, onRowsChange]
  );

  const handleBatchRepair = useCallback(async () => {
    if (!onRowsChange || !profileSnapshot) return;
    setBatchRepairing(true);

    try {
      const res = await fetch("/api/ai/repair/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, profileSnapshot }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: "Batch repair failed." } }));
        console.error("Batch repair error:", err.error?.message);
        return;
      }

      const data = await res.json() as {
        results: { rowIndex: number; suggestions: AiRepairSuggestion[] }[];
      };

      let updatedRows = [...rows];

      for (const result of data.results) {
        for (const suggestion of result.suggestions) {
          updatedRows = updatedRows.map((row) => {
            if (row.rowIndex !== result.rowIndex) return row;

            const cleaned = {
              ...row.cleaned,
              [suggestion.field]: suggestion.suggestedValue,
            };

            return {
              ...row,
              status: "ai_repaired" as const,
              cleaned,
              issues: [
                ...row.issues.filter((i) => i.field !== suggestion.field),
                {
                  field: suggestion.field,
                  severity: "fixed" as const,
                  message: `AI repair: ${suggestion.reasoning}`,
                  originalValue: suggestion.currentValue,
                  cleanedValue: suggestion.suggestedValue,
                },
              ],
            };
          });
        }
      }

      onRowsChange(updatedRows);
    } catch (error) {
      console.error("Batch repair error:", error);
    } finally {
      setBatchRepairing(false);
    }
  }, [rows, onRowsChange, profileSnapshot]);

  const rejectedCount = rows.filter((r) => r.status === "rejected").length;
  const needsReviewCount = rows.filter((r) => r.status === "needs_review").length;
  const aiRepairedCount = rows.filter((r) => r.status === "ai_repaired").length;

  return (
    <div className="space-y-4">
      {/* Filter pills + action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => {
          const count =
            f.key === "all"
              ? rows.length
              : rows.filter((r) => r.status === f.key).length;
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

        {/* Batch AI Repair */}
        {onRowsChange && needsReviewCount > 0 && (
          <button
            onClick={handleBatchRepair}
            disabled={batchRepairing}
            className="ml-auto rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-slate-950 disabled:opacity-50"
          >
            {batchRepairing
              ? "Repairing..."
              : `✦ Repair All (${needsReviewCount})`}
          </button>
        )}

        {rejectedCount > 0 && (
          <button
            onClick={handleDownloadRejected}
            disabled={isDownloading}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
          >
            {isDownloading ? "Downloading..." : "↓ Download Rejected CSV"}
          </button>
        )}
      </div>

      {/* AI Repaired summary banner */}
      {aiRepairedCount > 0 && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs text-violet-200">
          ✦ {aiRepairedCount} row{aiRepairedCount !== 1 ? "s" : ""} repaired
          with AI suggestions. These will be included in the import if confirmed.
        </div>
      )}

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
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-[var(--muted)]"
                  >
                    No rows match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const isExpanded = expandedRow === row.rowIndex;
                  const hasDetails =
                    row.issues.length > 0 || row.validationErrors.length > 0;

                  return (
                    <tr
                      key={row.rowIndex}
                      className={`hover:bg-white/5 cursor-pointer transition ${
                        isExpanded ? "bg-white/5" : ""
                      }`}
                      onClick={() =>
                        setExpandedRow(isExpanded ? null : row.rowIndex)
                      }
                    >
                      <td className="px-4 py-3 text-[var(--muted)] align-top">
                        {row.rowIndex}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs ${statusBadgeClasses[row.status]}`}
                        >
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
                        {row.cleaned.amount != null
                          ? String(row.cleaned.amount)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 align-top max-w-xs">
                        {/* Inline issue summary */}
                        {row.status === "rejected" &&
                          row.validationErrors.length > 0 && (
                            <div className="space-y-0.5">
                              {row.validationErrors.map((err, i) => (
                                <p key={i} className="text-xs text-rose-300">
                                  {err.field}: {err.message}
                                </p>
                              ))}
                            </div>
                          )}
                        {(row.status === "auto_fixed" ||
                          row.status === "needs_review" ||
                          row.status === "ai_repaired") &&
                          row.issues.length > 0 && (
                            <div>
                              {isExpanded ? (
                                <RowDiff issues={row.issues} />
                              ) : (
                                <p
                                  className={`text-xs ${
                                    row.status === "ai_repaired"
                                      ? "text-violet-300"
                                      : row.status === "needs_review"
                                        ? "text-amber-300"
                                        : "text-blue-300"
                                  }`}
                                >
                                  {row.issues.length} fix
                                  {row.issues.length !== 1 ? "es" : ""} applied
                                  — click to expand
                                </p>
                              )}
                            </div>
                          )}
                        {row.status === "duplicate" && (
                          <p className="text-xs text-slate-300">
                            Duplicate of another row
                          </p>
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

      {/* Expanded row details + AI repair */}
      {expandedRow !== null && (
        <div className="space-y-2">
          {rows
            .filter((r) => r.rowIndex === expandedRow)
            .map((row) => (
              <div
                key={row.rowIndex}
                className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3"
              >
                {/* Validation errors (if any) */}
                {row.validationErrors.length > 0 && (
                  <div className="mb-3 space-y-1">
                    <p className="text-xs font-medium text-rose-300">
                      Validation Errors
                    </p>
                    {row.validationErrors.map((err, i) => (
                      <p key={i} className="text-xs text-rose-300/80">
                        {err.field}: {err.message}
                      </p>
                    ))}
                  </div>
                )}

                {/* AI Repair panel — only in preview mode with profile */}
                {onRowsChange && profileSnapshot && (
                  <AiRepairPanel
                    row={row}
                    profileSnapshot={profileSnapshot}
                    onApplySuggestion={handleApplySuggestion}
                  />
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
