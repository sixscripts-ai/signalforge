import { NextRequest, NextResponse } from "next/server";
import { getAuditLogs, type AuditAction, type EntityType } from "@/lib/audit";
import { requireWorkspaceRole } from "@/lib/auth";

/**
 * GET /api/audit-log
 *
 * Returns paginated audit log entries for the active workspace.
 * Query parameters:
 *   - limit  (number, default 50)
 *   - cursor (ISO timestamp string for cursor-based pagination)
 *   - action (string, optional filter by action type)
 *   - entityType (string, optional filter by entity type)
 *   - dateFrom (ISO date string, optional)
 *   - dateTo   (ISO date string, optional)
 *
 * Access: owner and admin roles only.
 * Members cannot view team/admin audit events per the milestone requirements.
 */
export async function GET(request: NextRequest) {
  try {
    // Require owner or admin role — members cannot access audit log
    const wsMember = await requireWorkspaceRole(["owner", "admin"]);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 200);
    const cursor = searchParams.get("cursor") || undefined;
    const actionParam = searchParams.get("action") || undefined;
    const entityTypeParam = searchParams.get("entityType") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const result = await getAuditLogs({
      workspaceId: wsMember.workspaceId,
      limit,
      cursor,
      action: actionParam as AuditAction | undefined,
      entityType: entityTypeParam as EntityType | undefined,
      dateFrom,
      dateTo,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/audit-log error:", error);
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: "Failed to fetch audit logs." } },
      { status: 401 }
    );
  }
}
