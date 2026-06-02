import { db } from "@/lib/db";
import { importJob, importRow, normalizedRecord } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { processRows } from "@/lib/pipeline";
import { requireWorkspace, getCurrentUser } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";
import { createAuditLog } from "@/lib/audit";
import { resolveImportConfig } from "@/lib/import-templates";

type ConfirmPayload = {
  filename: string;
  sourceType: string;
  originalRows: Record<string, unknown>[];
  templateId?: string;
  /** AI repair patches: rowIndex → { field → suggestedValue } */
  rowPatches?: Record<number, Record<string, unknown>>;
};

export async function POST(request: Request) {
  let payload: ConfirmPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "Invalid JSON body." } }, { status: 400 });
  }

  const { filename, sourceType, originalRows, templateId, rowPatches } = payload;

  if (!filename || !sourceType || !Array.isArray(originalRows) || originalRows.length === 0) {
    return Response.json(
      { error: { code: "MISSING_FIELDS", message: "Missing required fields: filename, sourceType, originalRows." } },
      { status: 400 }
    );
  }

  let ws;
  let resolved;
  try {
    ws = await requireWorkspace();
    resolved = await resolveImportConfig({
      workspaceId: ws.id,
      templateId: templateId || undefined,
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: { code: "DB_ERROR", message: "Failed to load schema profile." } },
      { status: 500 }
    );
  }

  const { config: profile, templateSnapshot } = resolved;

  // HARDENING: Re-run the entire pipeline server-side to prevent client manipulation
  // If a template was selected, the server re-loads it and uses its stored config
  let { rows, summary } = processRows(originalRows, undefined, profile);

  // Apply AI repair patches: override cleaned data for patched rows
  // and promote their status to auto_fixed (since they were reviewed by AI)
  if (rowPatches && typeof rowPatches === "object") {
    rows = rows.map((row) => {
      const patch = rowPatches[String(row.rowIndex) as unknown as number] ?? rowPatches[row.rowIndex];
      if (!patch || Object.keys(patch).length === 0) return row;

      const cleaned = { ...row.cleaned };
      let patched = false;
      for (const [field, value] of Object.entries(patch)) {
        if (cleaned[field] !== value) {
          cleaned[field] = value;
          patched = true;
        }
      }

      if (!patched) return row;

      // Promote from needs_review to auto_fixed when AI-repaired
      const newStatus = row.status === "needs_review" ? "auto_fixed" : row.status;

      return {
        ...row,
        status: newStatus,
        cleaned,
        issues: [
          ...row.issues,
          {
            field: "multiple",
            severity: "fixed" as const,
            message: "AI-assisted repair applied during confirmation",
          },
        ],
      };
    });

    // Recalculate summary after patches
    summary = rows.reduce(
      (acc, row) => {
        acc.total++;
        if (row.status === "valid") acc.valid++;
        else if (row.status === "auto_fixed") acc.autoFixed++;
        else if (row.status === "needs_review") acc.needsReview++;
        else if (row.status === "rejected") acc.rejected++;
        else if (row.status === "duplicate") acc.duplicate++;
        acc.importable = acc.valid + acc.autoFixed;
        return acc;
      },
      { total: 0, valid: 0, autoFixed: 0, needsReview: 0, rejected: 0, duplicate: 0, importable: 0 }
    );
  }

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
    importTemplateId: templateSnapshot?.templateId ?? null,
    importTemplateSnapshot: templateSnapshot ?? null,
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
      summary: `Confirmed import "${filename}" — ${summary.valid} valid, ${summary.autoFixed} auto-fixed, ${summary.rejected} rejected, ${summary.duplicate} duplicate${
        templateSnapshot ? ` using template "${templateSnapshot.templateName}"` : ""
      }`,
      metadata: {
        filename,
        totalRows: summary.total,
        validRows: summary.valid,
        autoFixedRows: summary.autoFixed,
        rejectedRows: summary.rejected,
        duplicateRows: summary.duplicate,
        templateName: templateSnapshot?.templateName ?? null,
        templateId: templateSnapshot?.templateId ?? null,
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
      metadata: {
        filename,
        sourceType,
        templateName: templateSnapshot?.templateName ?? null,
      },
    });

    return Response.json(
      { error: { code: "IMPORT_FAILED", message: "Import failed while persisting rows." } },
      { status: 500 }
    );
  }
}
