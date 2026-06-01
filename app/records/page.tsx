import type { Prisma } from "@prisma/client";
import SectionHeader from "@/components/SectionHeader";
import RecordsTable from "@/components/RecordsTable";
import EmptyState from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;

  const where: Prisma.NormalizedRecordWhereInput = {};
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { company: { contains: q } },
      { externalId: { contains: q } },
    ];
  }

  const [records, categories] = await Promise.all([
    prisma.normalizedRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { importJob: true },
      take: 200,
    }),
    prisma.normalizedRecord.groupBy({
      by: ["category"],
      _count: { category: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Records"
        description={`${formatNumber(
          records.length
        )} normalized records across all imports.`}
      />

      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4"
        action="/records"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Search
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name, email, company, ID"
            className="w-64 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-border)]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Category
          </label>
          <select
            name="category"
            defaultValue={category ?? ""}
            className="w-48 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent-border)]"
          >
            <option value="">All categories</option>
            {categories
              .filter((c) => c.category)
              .map((c) => (
                <option key={c.category} value={c.category ?? ""}>
                  {c.category} ({c._count.category})
                </option>
              ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)]"
        >
          Apply
        </button>
      </form>

      {records.length ? (
        <RecordsTable records={records} />
      ) : (
        <EmptyState
          title="No records found"
          description="Try adjusting your search or import more data."
        />
      )}
    </div>
  );
}
