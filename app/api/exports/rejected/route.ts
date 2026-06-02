import { requireWorkspace, getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { currentUser } from "@clerk/nextjs/server";
import { generateRejectedCsv } from "@/lib/export-rejected";
import type { ProcessedRow } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ws = await requireWorkspace();

  const body = (await request.json()) as {
    rows: ProcessedRow[];
    importJobId?: string;
  };

  const { rows, importJobId } = body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: "No rows provided." }, { status: 400 });
  }

  try {
    const csv = generateRejectedCsv(rows);
    if (!csv) {
      return Response.json({ error: "No rejected rows to export." }, { status: 400 });
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const rejectedCount = rows.filter((r) => r.status === "rejected").length;

    // Audit: log rejected-row export (count only, no raw row data)
    const auditUserId = await getCurrentUser();
    const auditUser = await currentUser();
    createAuditLog({
      workspaceId: ws.id,
      actorUserId: auditUserId ?? "unknown",
      actorEmail: auditUser?.emailAddresses[0]?.emailAddress ?? undefined,
      action: "import.rejected_rows_exported",
      entityType: "export",
      summary: `Exported ${rejectedCount} rejected row${rejectedCount !== 1 ? "s" : ""}${
        importJobId ? ` for import ${importJobId.slice(0, 8)}` : ""
      } as CSV`,
      metadata: {
        totalRows: rows.length,
        rejectedRowCount: rejectedCount,
        importJobId: importJobId ?? null,
      },
    });

    return new Response(blob, {
      headers: {
        "Content-Type": blob.type,
        "Content-Disposition": `attachment; filename="rejected-rows.csv"`,
        "Content-Length": String(blob.size),
      },
    });
  } catch (error) {
    console.error("Rejected-row export error:", error);
    return Response.json(
      { error: "Export failed. Please try again." },
      { status: 500 }
    );
  }
}
