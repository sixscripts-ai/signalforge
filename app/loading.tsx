import SectionHeader from "@/components/SectionHeader";

export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      <SectionHeader title="Loading..." description="Fetching data..." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)]"
          />
        ))}
      </div>

      <div className="space-y-4 mt-8">
        <div className="h-6 w-48 rounded bg-[var(--panel-soft)]" />
        <div className="h-64 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)]" />
      </div>
    </div>
  );
}
