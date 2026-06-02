import { db } from "@/lib/db";
import { importJob, importRow, normalizedRecord, schemaProfile } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";
import { processRows } from "@/lib/pipeline";
import { DEFAULT_SCHEMA_PROFILE, SchemaProfileConfigSchema } from "@/lib/schema-profile";
import { requireWorkspace, getCurrentUser } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";
import { createAuditLog } from "@/lib/audit";

type ConfirmPayload = {
  filename: string;
  sourceType: string;
  originalRows: Record<string, unknown>[];
};

export async function POST(request: Request) {
  let payload: ConfirmPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "Invalid JSON body." } }, { status: 400 });
  }

  const { filename, sourceType, originalRows } = payload;

  if (!filename || !sourceType || !Array.isArray(originalRows) || originalRows.length === 0) {
    return Response.json(
      { error: { code: "MISSING_FIELDS", message: "Missing required fields: filename, sourceType, originalRows." } },
      { status: 400 }
    );
  }

  let profileRecord;
  let ws;
  try {
    ws = await requireWorkspace();
    profileRecord = await db
      .select()
      .from(schemaProfile)
      .where(eq(schemaProfile.workspaceId, ws.id))
      .orderBy(desc(schemaProfile.createdAt))
      .limit(1)
      .then((res) => res[0] || null);
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: { code: "DB_ERROR", message: "Failed to load schema profile." } },
      { status: 500 }
    );
  }

  const profile = profileRecord
    ? SchemaProfileConfigSchema.parse(profileRecord)
    : DEFAULT_SCHEMA_PROFILE;

  // HARDENING: Re-run the entire pipeline server-side to prevent client manipulation
  // We use the active schema profile from the DB to ensure consistency
  const { rows, summary } = processRows(originalRows, undefined, profile);

  const jobId = nanoid();

  await db.insert(importJob).values({
    id: jobId,
    workspaceId: ws.id,
    filename,
    sourceType,
    status: "importing",
    totalRows: summary.total,
    validRows: 0,
    autoFixedRows: 0,
    needsReviewRows: 0,
    duplicateRows: 0,
    rejectedRows: 0,
    schemaProfileSnapshot: profile,
  });

  try {
    for (const row of rows) {
      const rowId = nanoid();

      const allIssues = [
        ...row.issues,
        ...row.validationErrors.map((ve) => ({
          field: ve.field,
          message: ve.message,
          severity: ve.severity,
        })),
      ];

      await db.insert(importRow).values({
        id: rowId,
        workspaceId: ws.id,
        importJobId: jobId,
        rowIndex: row.rowIndex,
        status: row.status,
        originalData: JSON.stringify(row.original),
        cleanedData: JSON.stringify(row.cleaned),
        issues: JSON.stringify(allIssues),
      });

      // Only persist normalized records for importable rows
      if (row.status === "valid" || row.status === "auto_fixed") {
        await db.insert(normalizedRecord).values({
          id: nanoid(),
          workspaceId: ws.id,
          importJobId: jobId,
          externalId: (row.cleaned.externalId as string) ?? null,
          name: (row.cleaned.name as string) ?? null,
          email: (row.cleaned.email as string) ?? null,
          company: (row.cleaned.company as string) ?? null,
          category: (row.cleaned.category as string) ?? null,
          amount: (row.cleaned.amount as number) ?? null,
          status: (row.cleaned.status as string) ?? null,
          dedupeKey: row.dedupeKey,
          sourceRowIndex: row.rowIndex,
        });
      }
    }

    const [updated] = await db
      .update(importJob)
      .set({
        status: "imported",
        validRows: summary.valid,
        autoFixedRows: summary.autoFixed,
        needsReviewRows: summary.needsReview,
        rejectedRows: summary.rejected,
        duplicateRows: summary.duplicate,
        completedAt: new Date(),
      })
      .where(eq(importJob.id, jobId))
      .returning();

    // Audit: log import confirmed
    const userId = await getCurrentUser();
    const user = await currentUser();
    createAuditLog({
      workspaceId: ws.id,
      actorUserId: userId ?? "unknown",
      actorEmail: user?.emailAddresses[0]?.emailAddress ?? undefined,
      action: "import.confirmed",
      entityType: "import",
      entityId: jobId,
      summary: `Confirmed import "${filename}" — ${summary.valid} valid, ${summary.autoFixed} auto-fixed, ${summary.rejected} rejected, ${summary.duplicate} duplicate`,
      metadata: {
        filename,
        totalRows: summary.total,
        validRows: summary.valid,
        autoFixedRows: summary.autoFixed,
        rejectedRows: summary.rejected,
        duplicateRows: summary.duplicate,
      },
    });

    return Response.json({ import: updated });
  } catch (error) {
    await db
      .update(importJob)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Import failed.",
        completedAt: new Date(),
      })
      .where(eq(importJob.id, jobId));

    // Audit: log import failure
    const userId = await getCurrentUser();
    const user = await currentUser();
    createAuditLog({
      workspaceId: ws.id,
      actorUserId: userId ?? "unknown",
      actorEmail: user?.emailAddresses[0]?.emailAddress ?? undefined,
      action: "import.failed",
      entityType: "import",
      entityId: jobId,
      summary: `Import "${filename}" failed — ${error instanceof Error ? error.message : "Unknown error"}`,
      metadata: { filename, sourceType },
    });

    return Response.json(
      { error: { code: "IMPORT_FAILED", message: "Import failed while persisting rows." } },
      { status: 500 }
    );
  }
}
