import SectionHeader from "@/components/SectionHeader";
import JsonBlock from "@/components/JsonBlock";
import EmptyState from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { MAX_ROW_COUNT, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function safeParse(value: string | null) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return value;
  }
}

export default async function SettingsPage() {
  const profile = await prisma.schemaProfile.findFirst({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Settings"
        description="Import limits and the active schema profile."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Max Upload Size
          </p>
          <p className="mt-3 text-2xl font-semibold text-[var(--text)]">
            {MAX_UPLOAD_BYTES / 1024 / 1024} MB
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Max Rows Per Import
          </p>
          <p className="mt-3 text-2xl font-semibold text-[var(--text)]">
            {MAX_ROW_COUNT.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Active Schema Profile
        </h2>

        {profile ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--text)]">
                {profile.name}
              </span>
              <span className="text-xs text-[var(--muted)]">
                Updated {formatDateTime(profile.updatedAt)}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--text)]">
                  Required Fields
                </p>
                <JsonBlock data={safeParse(profile.requiredFields)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--text)]">
                  Field Mappings
                </p>
                <JsonBlock data={safeParse(profile.fieldMappings)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--text)]">
                  Validation Rules
                </p>
                <JsonBlock data={safeParse(profile.validationRules)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--text)]">
                  Dedupe Strategy
                </p>
                <JsonBlock data={safeParse(profile.dedupeStrategy)} />
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No schema profile"
            description="Seed the database or create a profile to configure validation rules."
          />
        )}
      </div>
    </div>
  );
}
