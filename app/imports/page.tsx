import Link from "next/link";
import SectionHeader from "@/components/SectionHeader";
import ImportTable from "@/components/ImportTable";
import EmptyState from "@/components/EmptyState";
import { db } from "@/lib/db";
import { importJob } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const imports = await db
    .select()
    .from(importJob)
    .orderBy(desc(importJob.createdAt));

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Imports"
        description="Every import job and its validation outcome."
        action={
          <Link
            href="/imports/new"
            className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)]"
          >
            New Import
          </Link>
        }
      />

      {imports.length ? (
        <ImportTable imports={imports} />
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
  );
}
