import { db } from "@/lib/db";
import { importJob, importRow, normalizedRecord } from "@/lib/db/schema";
import { eq, asc, desc, and } from "drizzle-orm";
import { requireWorkspace } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const ws = await requireWorkspace();
    const job = await db.query.importJob.findFirst({
      where: and(eq(importJob.id, id), eq(importJob.workspaceId, ws.id)),
    });

    if (!job) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Import not found." } }, { status: 404 });
    }

    const [dbRows, records] = await Promise.all([
      db
        .select()
        .from(importRow)
        .where(eq(importRow.importJobId, id))
        .orderBy(asc(importRow.rowIndex))
        .limit(100),
      db
        .select()
        .from(normalizedRecord)
        .where(eq(normalizedRecord.importJobId, id))
        .orderBy(desc(normalizedRecord.createdAt))
        .limit(50),
    ]);

  const safeParse = (v: string | null) => {
    try {
      return v ? JSON.parse(v) : null;
    } catch {
      return v;
    }
  };

  const parsedRows = dbRows.map((r) => ({
    ...r,
    originalData: safeParse(r.originalData),
    cleanedData: safeParse(r.cleanedData),
    issues: safeParse(r.issues) ?? [],
  }));

    const parsed = {
      ...job,
      rows: parsedRows,
      records,
    };

    return Response.json({ import: parsed });
  } catch (err) {
    console.error(err);
    return Response.json({ error: { code: "DB_ERROR", message: "Failed to fetch import details." } }, { status: 500 });
  }
}
