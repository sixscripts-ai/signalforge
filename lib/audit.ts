import { db } from "./db";
import { auditLog } from "./db/schema";
import { eq, desc, and, lt, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";

// ── Audit Action Types ──────────────────────────────────────────

export type AuditAction =
  | "workspace.created"
  | "workspace.updated"
  | "import.previewed"
  | "import.confirmed"
  | "import.failed"
  | "import.rejected_rows_exported"
  | "schema_profile.updated"
  | "records.exported"
  | "member.invited"
  | "member.joined"
  | "member.removed"
  | "member.role_changed"
  | "invitation.revoked";

export type EntityType =
  | "workspace"
  | "import"
  | "schema_profile"
  | "record"
  | "member"
  | "invitation"
  | "export";

// ── Write Helper ────────────────────────────────────────────────

export type CreateAuditLogParams = {
  workspaceId: string;
  actorUserId: string;
  actorEmail?: string;
  action: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

/**
 * Persist an audit log entry.
 *
 * Design principles:
 *  - Metadata must NOT contain raw CSV row payloads, uploaded file contents, or secrets.
 *  - Metadata should be compact and useful (e.g., row counts, filenames, changed sections).
 *  - Failures are logged to console but do NOT throw — audit writes must not corrupt
 *    the calling transaction. Callers that need transactional integrity (e.g. import confirm)
 *    should call `createAuditLog` inside the same transaction, or rely on the
 *    try/catch inside this function for non-critical writes.
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    const { workspaceId, actorUserId, actorEmail, action, entityType, entityId, summary, metadata } = params;

    await db.insert(auditLog).values({
      id: nanoid(),
      workspaceId,
      actorUserId,
      actorEmail: actorEmail ?? null,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      summary,
      metadata: metadata ?? null,
    });
  } catch (error) {
    // Audit writes must not crash the calling operation
    console.error("Failed to write audit log:", error);
  }
}

// ── Read Helper ─────────────────────────────────────────────────

export type AuditLogFilters = {
  workspaceId: string;
  limit?: number;
  cursor?: string; // createdAt ISO timestamp of the last item in the previous page
  action?: AuditAction;
  entityType?: EntityType;
  dateFrom?: string; // ISO date string
  dateTo?: string;   // ISO date string
};

export type AuditLogEntry = {
  id: string;
  workspaceId: string;
  actorUserId: string;
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AuditLogResult = {
  logs: AuditLogEntry[];
  nextCursor: string | null;
};

/**
 * Fetch audit logs for a workspace, newest first, with cursor-based pagination.
 * Returns a stable `nextCursor` (the createdAt timestamp of the last returned item)
 * that works even if new entries are inserted between pages.
 */
export async function getAuditLogs(filters: AuditLogFilters): Promise<AuditLogResult> {
  const { workspaceId, limit = 50, cursor, action, entityType, dateFrom, dateTo } = filters;

  const conditions = [eq(auditLog.workspaceId, workspaceId)];

  if (cursor) {
    conditions.push(lt(auditLog.createdAt, new Date(cursor)));
  }

  if (action) {
    conditions.push(eq(auditLog.action, action));
  }

  if (entityType) {
    conditions.push(eq(auditLog.entityType, entityType));
  }

  if (dateFrom) {
    conditions.push(gte(auditLog.createdAt, new Date(dateFrom)));
  }

  if (dateTo) {
    conditions.push(lte(auditLog.createdAt, new Date(dateTo)));
  }

  const rows = await db
    .select()
    .from(auditLog)
    .where(and(...conditions))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit + 1); // fetch one extra to detect if there are more pages

  const hasMore = rows.length > limit;
  const logsToReturn = hasMore ? rows.slice(0, limit) : rows;

  const nextCursor = hasMore
    ? logsToReturn[logsToReturn.length - 1].createdAt.toISOString()
    : null;

  return {
    logs: logsToReturn.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      actorUserId: row.actorUserId,
      actorEmail: row.actorEmail,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      summary: row.summary,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

// Re-export pure label helpers for convenience (server-side usage)
export { getAuditActionLabel } from "./audit-labels";
