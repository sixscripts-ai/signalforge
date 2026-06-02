'use client';

import { useState, useCallback } from "react";
import type { ProcessedRow } from "@/lib/pipeline";
import type { SchemaProfileConfig } from "@/lib/schema-profile";
import type {
  AiRepairSuggestion,
  AiRepairResult,
} from "@/lib/ai/repair";

// ── Types ───────────────────────────────────────────────────────

type AiRepairPanelProps = {
  /** The "needs_review" row to suggest fixes for */
  row: ProcessedRow;
  /** Schema profile config used during preview */
  profileSnapshot?: SchemaProfileConfig;
  /** Called when a suggestion is applied — parent is responsible for row state */
  onApplySuggestion: (rowIndex: number, suggestion: AiRepairSuggestion) => void;
};

type PanelState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; result: AiRepairResult }
  | { status: "error"; message: string };

// ── Confidence Helpers ──────────────────────────────────────────

const confidenceColors: Record<string, string> = {
  high: "border-emerald-500/30 bg-emerald-500/5",
  medium: "border-amber-500/30 bg-amber-500/5",
  low: "border-slate-500/30 bg-slate-500/5",
};

const confidenceBadges: Record<string, string> = {
  high: "border-emerald-500/30 text-emerald-300 bg-emerald-500/10",
  medium: "border-amber-500/30 text-amber-300 bg-amber-500/10",
  low: "border-slate-500/30 text-slate-300 bg-slate-500/10",
};

// ── Component ───────────────────────────────────────────────────

export default function AiRepairPanel({
  row,
  profileSnapshot,
  onApplySuggestion,
}: AiRepairPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>({ status: "idle" });
  const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set());
  const [dismissedFields, setDismissedFields] = useState<Set<string>>(new Set());

  const handleSuggest = useCallback(async () => {
    setPanelState({ status: "loading" });
    try {
      const res = await fetch("/api/ai/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          row,
          profileSnapshot: profileSnapshot ?? null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: "Request failed." } }));
        throw new Error(err.error?.message ?? "AI repair failed.");
      }

      const result: AiRepairResult = await res.json();
      setPanelState({ status: "loaded", result });
    } catch (err) {
      setPanelState({
        status: "error",
        message: err instanceof Error ? err.message : "AI repair failed.",
      });
    }
  }, [row, profileSnapshot]);

  const handleApply = useCallback(
    (suggestion: AiRepairSuggestion) => {
      onApplySuggestion(row.rowIndex, suggestion);
      setAppliedFields((prev) => new Set(prev).add(suggestion.field));
    },
    [row.rowIndex, onApplySuggestion]
  );

  const handleDismiss = useCallback(
    (field: string) => {
      setDismissedFields((prev) => new Set(prev).add(field));
    },
    []
  );

  // Only show for needs_review rows
  if (row.status !== "needs_review") return null;

  const hasActions = appliedFields.size > 0 || dismissedFields.size > 0;
  const visibleSuggestions =
    panelState.status === "loaded"
      ? panelState.result.suggestions.filter(
          (s) => !appliedFields.has(s.field) && !dismissedFields.has(s.field)
        )
      : [];

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      {/* Status: idle — show suggest button */}
      {panelState.status === "idle" && (
        <button
          onClick={handleSuggest}
          className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-slate-950"
        >
          ✦ Suggest AI Fix
        </button>
      )}

      {/* Status: loading */}
      {panelState.status === "loading" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[var(--accent)] border-t-transparent" />
            AI is analyzing this row...
          </div>
          <div className="animate-pulse space-y-2">
            <div className="h-8 rounded-lg bg-[var(--border)]/50" />
            <div className="h-8 w-3/4 rounded-lg bg-[var(--border)]/50" />
          </div>
        </div>
      )}

      {/* Status: loaded */}
      {panelState.status === "loaded" && (
        <div className="space-y-2">
          {visibleSuggestions.length > 0 ? (
            <>
              <p className="text-xs font-medium text-[var(--accent)]">
                AI Suggestions ({visibleSuggestions.length})
              </p>
              <div className="space-y-2">
                {visibleSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3 ${confidenceColors[suggestion.confidence] ?? confidenceColors.medium}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--text)]">
                            {suggestion.field}
                          </span>
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase ${confidenceBadges[suggestion.confidence] ?? confidenceBadges.medium}`}
                          >
                            {suggestion.confidence}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs">
                          <span className="text-rose-300/70 line-through">
                            {formatSuggestionValue(suggestion.currentValue)}
                          </span>
                          <span className="text-[var(--muted)]">→</span>
                          <span className="font-medium text-emerald-300">
                            {formatSuggestionValue(suggestion.suggestedValue)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--muted)]">
                          {suggestion.reasoning}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => handleApply(suggestion)}
                          className="rounded-md border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-300 transition hover:bg-emerald-500/10"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => handleDismiss(suggestion.field)}
                          className="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted)] transition hover:text-[var(--text)]"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
              <p className="text-xs text-[var(--muted)]">
                {hasActions
                  ? "All suggestions have been reviewed."
                  : "AI could not generate suggestions for this row."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Status: error */}
      {panelState.status === "error" && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-rose-300">{panelState.message}</p>
          <button
            onClick={handleSuggest}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────

function formatSuggestionValue(value: unknown): string {
  if (value === null || value === undefined) return "∅ (empty)";
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}
