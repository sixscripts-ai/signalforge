import Link from "next/link";
import { notFound } from "next/navigation";
import SectionHeader from "@/components/SectionHeader";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import ErrorTable from "@/components/ErrorTable";
import RecordsTable from "@/components/RecordsTable";
import EmptyState from "@/components/EmptyState";
import { db } from "@/lib/db";
import { importJob as importJobTable, validationError, normalizedRecord } from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";

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

  const [errors, records] = await Promise.all([
    db.select().from(validationError).where(eq(validationError.importJobId, id)).orderBy(asc(validationError.rowIndex)).limit(100),
    db.select().from(normalizedRecord).where(eq(normalizedRecord.importJobId, id)).orderBy(desc(normalizedRecord.createdAt)).limit(50),
  ]);

  const importJob = {
    ...jobRow,
    validationErrors: errors,
    records: records,
  };

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
        description={`${importJob.sourceType.toUpperCase()} · imported ${formatDateTime(
          importJob.createdAt
        )}`}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          label="Invalid"
          value={formatNumber(importJob.invalidRows)}
          tone="danger"
        />
        <StatCard
          label="Duplicates"
          value={formatNumber(importJob.duplicateRows)}
          tone="warning"
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Normalized Records
        </h2>
        {recordsWithJob.length ? (
          <RecordsTable records={recordsWithJob} />
        ) : (
          <EmptyState
            title="No stored records"
            description="This import produced no valid normalized records."
          />
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Validation Errors
        </h2>
        {importJob.validationErrors.length ? (
          <ErrorTable errors={importJob.validationErrors} />
        ) : (
          <EmptyState
            title="No validation errors"
            description="Every row in this import passed validation."
          />
        )}
      </div>
    </div>
  );
}
