'use client';

import { useReducer, useCallback } from "react";
import SectionHeader from "@/components/SectionHeader";
import { getAuditActionLabel } from "@/lib/audit-labels";

// ── Types ───────────────────────────────────────────────────────

type AuditLogEntry = {
  id: string;
  actorUserId: string;
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type AuditLogResult = {
  logs: AuditLogEntry[];
  nextCursor: string | null;
};

type State = {
  logs: AuditLogEntry[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; logs: AuditLogEntry[]; nextCursor: string | null }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "LOAD_MORE_START" }
  | { type: "LOAD_MORE_SUCCESS"; logs: AuditLogEntry[]; nextCursor: string | null }
  | { type: "LOAD_MORE_ERROR"; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, logs: [], nextCursor: null, error: null };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, logs: action.logs, nextCursor: action.nextCursor };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.error };
    case "LOAD_MORE_START":
      return { ...state, loadingMore: true };
    case "LOAD_MORE_SUCCESS":
      return {
        ...state,
        loadingMore: false,
        logs: [...state.logs, ...action.logs],
        nextCursor: action.nextCursor,
      };
    case "LOAD_MORE_ERROR":
      return { ...state, loadingMore: false, error: action.error };
    default:
      return state;
  }
}

const initialState: State = {
  logs: [],
  nextCursor: null,
  loading: true,
  loadingMore: false,
  error: null,
};

// ── Relative Time Helper ────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Action Icon Map ─────────────────────────────────────────────

const actionIcons: Record<string, string> = {
  "workspace.created": "🏢",
  "workspace.updated": "🏢",
  "import.previewed": "👁️",
  "import.confirmed": "✅",
  "import.failed": "❌",
  "import.rejected_rows_exported": "📤",
  "schema_profile.updated": "⚙️",
  "records.exported": "📥",
  "member.invited": "📧",
  "member.joined": "👋",
  "member.removed": "🚫",
  "member.role_changed": "🔄",
  "invitation.revoked": "↩️",
};

function getActionIcon(action: string): string {
  return actionIcons[action] ?? "📋";
}

// ── Main Component ──────────────────────────────────────────────

export default function ActivityPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [filterAction, setFilterAction] = useReducer(
    (_prev: string, next: string) => next,
    ""
  );
  const [filterEntity, setFilterEntity] = useReducer(
    (_prev: string, next: string) => next,
    ""
  );

  const fetchLogs = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (filterAction) params.set("action", filterAction);
      if (filterEntity) params.set("entityType", filterEntity);
      params.set("limit", "30");

      const res = await fetch(`/api/audit-log?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Failed to fetch activity log");
      }
      return res.json() as Promise<AuditLogResult>;
    },
    [filterAction, filterEntity]
  );

  const handleFilterChange = useCallback(
    (type: "action" | "entity", value: string) => {
      if (type === "action") setFilterAction(value);
      else setFilterEntity(value);
      dispatch({ type: "FETCH_START" });
      fetchLogs()
        .then((result) =>
          dispatch({ type: "FETCH_SUCCESS", logs: result.logs, nextCursor: result.nextCursor })
        )
        .catch((err) =>
          dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Unknown error" })
        );
    },
    [fetchLogs]
  );

  // Initial fetch on mount — runs once since handleFilterChange is stable
  const [initialized, setInitialized] = useReducer(() => true, false);
  if (!initialized) {
    // This runs once before the first render
    setInitialized();
    dispatch({ type: "FETCH_START" });
    fetchLogs()
      .then((result) =>
        dispatch({ type: "FETCH_SUCCESS", logs: result.logs, nextCursor: result.nextCursor })
      )
      .catch((err) =>
        dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Unknown error" })
      );
  }

  const handleLoadMore = async () => {
    if (!state.nextCursor || state.loadingMore) return;
    dispatch({ type: "LOAD_MORE_START" });
    try {
      const result = await fetchLogs(state.nextCursor);
      dispatch({ type: "LOAD_MORE_SUCCESS", logs: result.logs, nextCursor: result.nextCursor });
    } catch (err) {
      dispatch({
        type: "LOAD_MORE_ERROR",
        error: err instanceof Error ? err.message : "Failed to load more",
      });
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Activity"
        description="Chronological audit log of workspace actions."
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          value={filterAction}
          onChange={(e) => handleFilterChange("action", e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          <option value="">All Actions</option>
          <option value="import.previewed">Import Previewed</option>
          <option value="import.confirmed">Import Confirmed</option>
          <option value="import.failed">Import Failed</option>
          <option value="import.rejected_rows_exported">Rejected Rows Exported</option>
          <option value="schema_profile.updated">Schema Profile Updated</option>
          <option value="records.exported">Records Exported</option>
          <option value="member.invited">Member Invited</option>
          <option value="member.joined">Member Joined</option>
          <option value="member.removed">Member Removed</option>
          <option value="member.role_changed">Member Role Changed</option>
          <option value="invitation.revoked">Invitation Revoked</option>
          <option value="workspace.created">Workspace Created</option>
          <option value="workspace.updated">Workspace Updated</option>
        </select>

        <select
          value={filterEntity}
          onChange={(e) => handleFilterChange("entity", e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          <option value="">All Entity Types</option>
          <option value="workspace">Workspace</option>
          <option value="import">Import</option>
          <option value="schema_profile">Schema Profile</option>
          <option value="record">Record</option>
          <option value="member">Member</option>
          <option value="invitation">Invitation</option>
          <option value="export">Export</option>
        </select>
      </div>

      {/* Error State */}
      {state.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {state.error}
        </div>
      )}

      {/* Loading State */}
      {state.loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-4"
            >
              <div className="h-4 w-3/4 rounded bg-[var(--border)]" />
              <div className="mt-2 h-3 w-1/2 rounded bg-[var(--border)]" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!state.loading && !state.error && state.logs.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-6 py-12 text-center">
          <p className="text-3xl">📋</p>
          <p className="mt-3 text-lg font-medium text-[var(--text)]">
            No activity yet
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Actions performed in this workspace will appear here.
          </p>
        </div>
      )}

      {/* Activity List */}
      {!state.loading && state.logs.length > 0 && (
        <div className="space-y-2">
          {state.logs.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 transition hover:border-[var(--accent-border)]"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-lg" title={entry.action}>
                  {getActionIcon(entry.action)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-[var(--text)]">
                      {entry.actorEmail && (
                        <span className="text-[var(--accent)]">{entry.actorEmail}</span>
                      )}{" "}
                      {entry.summary}
                    </p>
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {timeAgo(entry.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <span className="rounded border border-[var(--border)] px-1.5 py-0.5">
                      {getAuditActionLabel(entry.action)}
                    </span>
                    {entry.entityType && (
                      <span className="rounded border border-[var(--border)] px-1.5 py-0.5">
                        {entry.entityType}
                      </span>
                    )}
                  </div>
                  {/* Expandable metadata */}
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-[var(--accent)] hover:underline">
                        Details
                      </summary>
                      <pre className="mt-1 overflow-x-auto rounded bg-[var(--bg)] p-2 text-xs text-[var(--muted)]">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {state.nextCursor && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleLoadMore}
            disabled={state.loadingMore}
            className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-6 py-2 text-sm text-[var(--text)] transition hover:border-[var(--accent-border)] disabled:opacity-50"
          >
            {state.loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
