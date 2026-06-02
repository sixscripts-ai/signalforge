import { db } from "@/lib/db";
import { importJob, rawRow, validationError, normalizedRecord } from "@/lib/db/schema";
import { eq, asc, desc } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const job = await db.query.importJob.findFirst({
    where: eq(importJob.id, id),
  });

  if (!job) {
    return Response.json({ error: "Import not found." }, { status: 404 });
  }

  const [rawRows, errors, records] = await Promise.all([
    db
      .select()
      .from(rawRow)
      .where(eq(rawRow.importJobId, id))
      .orderBy(asc(rawRow.rowIndex))
      .limit(50),
    db
      .select()
      .from(validationError)
      .where(eq(validationError.importJobId, id))
      .orderBy(asc(validationError.rowIndex))
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

  const parsed = {
    ...job,
    rawRows: rawRows.map((r) => ({ ...r, rawData: safeParse(r.rawData) })),
    validationErrors: errors,
    records,
  };

  return Response.json({ import: parsed });
}
