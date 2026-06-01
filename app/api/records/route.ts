import { db } from "@/lib/db";
import { normalizedRecord, importJob } from "@/lib/db/schema";
import { eq, desc, or, ilike } from "drizzle-orm";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const importId = url.searchParams.get("importId")?.trim();

  let query = db
    .select({
      record: normalizedRecord,
      importJob: importJob,
    })
    .from(normalizedRecord)
    .leftJoin(importJob, eq(normalizedRecord.importJobId, importJob.id))
    .orderBy(desc(normalizedRecord.createdAt))
    .$dynamic();

  const conditions = [];

  if (status) conditions.push(eq(normalizedRecord.status, status));
  if (category) conditions.push(eq(normalizedRecord.category, category));
  if (importId) conditions.push(eq(normalizedRecord.importJobId, importId));

  if (q) {
    conditions.push(
      or(
        ilike(normalizedRecord.name, `%${q}%`),
        ilike(normalizedRecord.email, `%${q}%`),
        ilike(normalizedRecord.company, `%${q}%`),
        ilike(normalizedRecord.externalId, `%${q}%`)
      )
    );
  }

  if (conditions.length > 0) {
    const { and } = await import("drizzle-orm");
    query = query.where(and(...conditions));
  }

  const results = await query;

  const records = results.map((r) => ({
    ...r.record,
    importJob: r.importJob,
  }));

  return Response.json({ records });
}
