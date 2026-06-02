import Link from "next/link";
import { notFound } from "next/navigation";
import SectionHeader from "@/components/SectionHeader";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import RecordsTable from "@/components/RecordsTable";
import RowReviewTable from "@/components/RowReviewTable";
import EmptyState from "@/components/EmptyState";
import ExportButton from "@/components/ExportButton";
import { db } from "@/lib/db";
import { importJob as importJobTable, importRow as importRowTable, normalizedRecord } from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import type { ProcessedRow } from "@/lib/pipeline";
import { SchemaProfileConfigSchema } from "@/lib/schema-profile";

export const dynamic = "force-dynamic";

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const jobResult = await db.select().from(importJobTable).where(eq(importJobTable.id, id)).limit(1);
  const jobRow = jobResult[0];

  if (!jobRow) {
    notFound();
  }

  const [dbRows, records] = await Promise.all([
    db.select().from(importRowTable).where(eq(importRowTable.importJobId, id)).orderBy(asc(importRowTable.rowIndex)),
    db.select().from(normalizedRecord).where(eq(normalizedRecord.importJobId, id)).orderBy(desc(normalizedRecord.createdAt)).limit(50),
  ]);

  const safeParse = (v: string | null) => {
    try {
      return v ? JSON.parse(v) : null;
    } catch {
      return v;
    }
  };

  const mappedRows: ProcessedRow[] = dbRows.map((r) => {
    const original = safeParse(r.originalData) ?? {};
    const cleaned = safeParse(r.cleanedData) ?? {};
    const allIssues = (safeParse(r.issues) ?? []) as Array<{
      field: string;
      message: string;
      severity: "warning" | "error" | "fixed";
      originalValue?: unknown;
      cleanedValue?: unknown;
    }>;

    return {
      rowIndex: r.rowIndex,
      status: r.status as ProcessedRow["status"],
      original,
      cleaned,
      dedupeKey: "", // Not strictly needed for audit UI
      issues: allIssues.filter((i) => i.severity === "warning" || i.severity === "fixed"),
      validationErrors: allIssues
        .filter((i) => i.severity === "error")
        .map((i) => ({ ...i, severity: "error" as const, rowIndex: r.rowIndex })),
    };
  });

  const importJob = {
    ...jobRow,
    records: records,
  };

  // Extract template snapshot if present
  const templateSnapshot = importJob.importTemplateSnapshot as {
    templateId: string;
    templateName: string;
    config: Record<string, unknown>;
  } | null;

  let profileName = "Unknown Profile";
  if (importJob.schemaProfileSnapshot) {
    const res = SchemaProfileConfigSchema.safeParse(importJob.schemaProfileSnapshot);
    if (res.success) {
      profileName = res.data.name;
    }
  }

  const quality = importJob.totalRows
    ? importJob.validRows / importJob.totalRows
    : 0;

  const recordsWithJob = importJob.records.map((record) => ({
    ...record,
    importJob,
  }));

  return (
    <div className="space-y-8">
      <SectionHeader
        title={importJob.filename}
        description={`${importJob.sourceType.toUpperCase()} · ${profileName} · imported ${formatDateTime(
          importJob.createdAt
        )}${templateSnapshot ? ` · Template: ${templateSnapshot.templateName}` : ""}`}
        action={
          <Link
            href="/imports"
            className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            ← Back to imports
          </Link>
        }
      />

      <div className="flex items-center gap-3">
        <StatusBadge status={importJob.status} />
        {importJob.completedAt ? (
          <span className="text-xs text-[var(--muted)]">
            Completed {formatDateTime(importJob.completedAt)}
          </span>
        ) : null}
      </div>

      {importJob.errorMessage ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {importJob.errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard
          label="Total Rows"
          value={formatNumber(importJob.totalRows)}
          tone="accent"
        />
        <StatCard
          label="Valid"
          value={formatNumber(importJob.validRows)}
          hint={formatPercent(quality)}
          tone="success"
        />
        <StatCard
          label="Auto-fixed"
          value={formatNumber(importJob.autoFixedRows)}
          tone="accent"
        />
        <StatCard
          label="Needs Review"
          value={formatNumber(importJob.needsReviewRows)}
          tone="warning"
        />
        <StatCard
          label="Duplicates"
          value={formatNumber(importJob.duplicateRows)}
          tone="warning"
        />
        <StatCard
          label="Rejected"
          value={formatNumber(importJob.rejectedRows)}
          tone="danger"
        />
      </div>

      <div className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-6">
        <ExportButton scope="import-rows" importJobId={id} label="Export Rows (CSV)" />
        {recordsWithJob.length > 0 && (
          <ExportButton scope="import-records" importJobId={id} label="Export Records (CSV)" />
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Audit Trail
        </h2>
        {mappedRows.length ? (
          <RowReviewTable rows={mappedRows} importJobId={id} />
        ) : (
          <EmptyState
            title="No stored rows"
            description="There are no row-level details stored for this import."
          />
        )}
      </div>

      {recordsWithJob.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            Normalized Records Sample
          </h2>
          <RecordsTable records={recordsWithJob} />
        </div>
      )}
    </div>
  );
}
