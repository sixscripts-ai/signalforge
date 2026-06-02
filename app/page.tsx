import Link from "next/link";
import SectionHeader from "@/components/SectionHeader";
import StatCard from "@/components/StatCard";
import ImportTable from "@/components/ImportTable";
import EmptyState from "@/components/EmptyState";
import { getDashboardStats } from "@/lib/analytics";
import { formatNumber, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Dashboard"
        description="Overview of import activity, data quality, and recent jobs."
        action={
          <Link
            href="/imports/new"
            className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)]"
          >
            New Import
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total Imports"
          value={formatNumber(stats.totalImports)}
          hint={`${formatNumber(stats.successImports)} succeeded · ${formatNumber(
            stats.failedImports
          )} failed`}
          tone="accent"
        />
        <StatCard
          label="Records Stored"
          value={formatNumber(stats.totalRecords)}
          hint={`${formatNumber(stats.totalRows)} rows processed`}
        />
        <StatCard
          label="Data Quality"
          value={formatPercent(stats.qualityScore)}
          hint={`${formatNumber(stats.importedRows)} imported rows`}
          tone="success"
        />
        <StatCard
          label="Auto-fixed"
          value={formatNumber(stats.autoFixedRows)}
          hint="Cleaned automatically"
          tone="accent"
        />
        <StatCard
          label="Needs Review"
          value={formatNumber(stats.needsReviewRows)}
          hint="Requires human check"
          tone="warning"
        />
        <StatCard
          label="Rejected & Dupes"
          value={formatNumber(stats.rejectedRows + stats.duplicateRows)}
          hint={`${formatNumber(stats.rejectedRows)} rejected · ${formatNumber(
            stats.duplicateRows
          )} duplicate`}
          tone="danger"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            Recent Imports
          </h2>
          <Link
            href="/imports"
            className="text-sm text-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            View all →
          </Link>
        </div>

        {stats.recentImports.length ? (
          <ImportTable imports={stats.recentImports} />
        ) : (
          <EmptyState
            title="No imports yet"
            description="Upload your first CSV or JSON file to start building your record set."
            action={
              <Link
                href="/imports/new"
                className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)]"
              >
                New Import
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
