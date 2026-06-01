import SectionHeader from "@/components/SectionHeader";
import AnalyticsCard from "@/components/AnalyticsCard";
import EmptyState from "@/components/EmptyState";
import { getAnalyticsData } from "@/lib/analytics";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

type BreakdownRow = { label: string; count: number };

function BreakdownList({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: BreakdownRow[];
  emptyLabel: string;
}) {
  const max = rows.reduce((acc, row) => Math.max(acc, row.count), 0);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
      <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
      {rows.length ? (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text)]">{row.label}</span>
                <span className="text-[var(--muted)]">
                  {formatNumber(row.count)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full bg-[var(--accent)]"
                  style={{ width: `${max ? (row.count / max) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-[var(--muted)]">{emptyLabel}</p>
      )}
    </div>
  );
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  const categoryRows: BreakdownRow[] = data.categoryBreakdown
    .filter((row) => row.category)
    .map((row) => ({ label: row.category as string, count: row._count.category }));

  const companyRows: BreakdownRow[] = data.companyBreakdown
    .filter((row) => row.company)
    .map((row) => ({ label: row.company as string, count: row._count.company }));

  const statusRows: BreakdownRow[] = data.statusBreakdown
    .filter((row) => row.status)
    .map((row) => ({ label: row.status as string, count: row._count.status }));

  const errorRows: BreakdownRow[] = data.errorBreakdown.map((row) => ({
    label: row.field,
    count: row._count.field,
  }));

  const hasData = data.totalImports > 0;

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Analytics"
        description="Data quality and distribution across all imports."
      />

      {hasData ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AnalyticsCard
              title="Import Success Rate"
              value={formatPercent(data.importSuccessRate)}
              description="Valid rows / total rows"
            />
            <AnalyticsCard
              title="Duplicate Rate"
              value={formatPercent(data.duplicateRate)}
              description="Duplicate rows / total rows"
            />
            <AnalyticsCard
              title="Total Amount"
              value={formatCurrency(data.totalAmount)}
              description="Sum of record amounts"
            />
            <AnalyticsCard
              title="Average Amount"
              value={formatCurrency(data.averageAmount)}
              description="Mean per record"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownList
              title="Records by Category"
              rows={categoryRows}
              emptyLabel="No categorized records."
            />
            <BreakdownList
              title="Records by Company"
              rows={companyRows}
              emptyLabel="No company data."
            />
            <BreakdownList
              title="Records by Status"
              rows={statusRows}
              emptyLabel="No status data."
            />
            <BreakdownList
              title="Top Validation Errors"
              rows={errorRows}
              emptyLabel="No validation errors recorded."
            />
          </div>
        </>
      ) : (
        <EmptyState
          title="No analytics yet"
          description="Import data to populate distribution and quality metrics."
        />
      )}
    </div>
  );
}
