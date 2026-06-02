import { db } from "@/lib/db";
import { importJob, importRow, normalizedRecord } from "@/lib/db/schema";
import { eq, asc, desc, and } from "drizzle-orm";
import { requireWorkspace } from "@/lib/auth";
import {
  type ExportFormat,
  makeExportFilename,
  formatExport,
  importRowsToExportable,
  recordsToExportable,
} from "@/lib/export";

export async function POST(request: Request) {
  const ws = await requireWorkspace();

  const body = (await request.json()) as {
    format: ExportFormat;
    scope: "records" | "import-rows" | "import-records";
    importJobId?: string;
  };

  const { format, scope, importJobId } = body;

  if (!format || !["csv", "json", "xlsx"].includes(format)) {
    return Response.json({ error: "Invalid format. Use csv, json, or xlsx." }, { status: 400 });
  }

  if (!scope || !["records", "import-rows", "import-records"].includes(scope)) {
    return Response.json(
      { error: "Invalid scope. Use records, import-rows, or import-records." },
      { status: 400 }
    );
  }

  try {
    let rows: Record<string, unknown>[];
    let baseFilename: string;

    if (scope === "records") {
      const records = await db
        .select()
        .from(normalizedRecord)
        .where(eq(normalizedRecord.workspaceId, ws.id))
        .orderBy(desc(normalizedRecord.createdAt))
        .limit(10_000);

      rows = recordsToExportable(records);
      baseFilename = `all-records`;
    } else if (scope === "import-rows") {
      if (!importJobId) {
        return Response.json(
          { error: "importJobId is required for import-rows scope." },
          { status: 400 }
        );
      }

      // Verify ownership
      const job = await db
        .select()
        .from(importJob)
        .where(and(eq(importJob.id, importJobId), eq(importJob.workspaceId, ws.id)))
        .limit(1)
        .then((r) => r[0]);

      if (!job) {
        return Response.json({ error: "Import not found." }, { status: 404 });
      }

      const dbRows = await db
        .select()
        .from(importRow)
        .where(eq(importRow.importJobId, importJobId))
        .orderBy(asc(importRow.rowIndex));

      rows = importRowsToExportable(dbRows);
      baseFilename = `import-${importJobId}-rows`;
    } else {
      // import-records
      if (!importJobId) {
        return Response.json(
          { error: "importJobId is required for import-records scope." },
          { status: 400 }
        );
      }

      const job = await db
        .select()
        .from(importJob)
        .where(and(eq(importJob.id, importJobId), eq(importJob.workspaceId, ws.id)))
        .limit(1)
        .then((r) => r[0]);

      if (!job) {
        return Response.json({ error: "Import not found." }, { status: 404 });
      }

      const records = await db
        .select()
        .from(normalizedRecord)
        .where(eq(normalizedRecord.importJobId, importJobId))
        .orderBy(desc(normalizedRecord.createdAt));

      rows = recordsToExportable(records);
      baseFilename = `import-${importJobId}-records`;
    }

    const filename = makeExportFilename(baseFilename, format);
    const blob = formatExport(rows, format);

    return new Response(blob, {
      headers: {
        "Content-Type": blob.type,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(blob.size),
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return Response.json(
      { error: "Export failed. Please try again." },
      { status: 500 }
    );
  }
}


