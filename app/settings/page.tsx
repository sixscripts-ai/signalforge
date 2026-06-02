import SectionHeader from "@/components/SectionHeader";
import SchemaProfileForm from "@/components/SchemaProfileForm";
import ImportTemplateSettings from "@/components/ImportTemplateSettings";
import { db } from "@/lib/db";
import { schemaProfile, webhook, apiKey } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { MAX_ROW_COUNT, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { SchemaProfileConfigSchema, DEFAULT_SCHEMA_PROFILE } from "@/lib/schema-profile";
import { requireWorkspace, getWorkspaceMembership } from "@/lib/auth";
import TeamSettings from "@/components/TeamSettings";
import WebhookSettings from "@/components/WebhookSettings";
import ApiKeySettings from "@/components/ApiKeySettings";
import { workspaceMember, workspaceInvitation } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ws = await requireWorkspace();

  const profileRecord = await db
    .select()
    .from(schemaProfile)
    .where(eq(schemaProfile.workspaceId, ws.id))
    .orderBy(desc(schemaProfile.createdAt))
    .limit(1)
    .then((res) => res[0] || null);

  const activeProfile = profileRecord
    ? SchemaProfileConfigSchema.parse(profileRecord)
    : DEFAULT_SCHEMA_PROFILE;

  // Fetch all profiles for the template settings form
  const allProfiles = await db
    .select({ id: schemaProfile.id, name: schemaProfile.name })
    .from(schemaProfile)
    .where(eq(schemaProfile.workspaceId, ws.id))
    .orderBy(desc(schemaProfile.createdAt));

  const wsMember = await getWorkspaceMembership();

  const webhooks = await db
    .select()
    .from(webhook)
    .where(eq(webhook.workspaceId, ws.id))
    .orderBy(desc(webhook.createdAt));

  const apiKeys = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.workspaceId, ws.id))
    .orderBy(desc(apiKey.createdAt));
  const members = await db
    .select()
    .from(workspaceMember)
    .where(eq(workspaceMember.workspaceId, ws.id))
    .orderBy(desc(workspaceMember.createdAt));

  let invitations: (typeof workspaceInvitation.$inferSelect)[] = [];
  if (wsMember && (wsMember.role === "admin" || wsMember.role === "owner")) {
    invitations = await db
      .select()
      .from(workspaceInvitation)
      .where(eq(workspaceInvitation.workspaceId, ws.id))
      .orderBy(desc(workspaceInvitation.createdAt));
  }

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
        <SchemaProfileForm initialProfile={activeProfile} />
      </div>

      <div className="border-t border-[var(--border)] pt-8">
        <ImportTemplateSettings profiles={allProfiles} />
      </div>

      {wsMember && (
        <TeamSettings
          members={members.map(m => ({
            id: m.id,
            userId: m.userId,
            role: m.role,
            createdAt: m.createdAt.toISOString()
          }))}
          invitations={invitations.map(i => ({
            id: i.id,
            email: i.email,
            role: i.role,
            status: i.status,
            expiresAt: i.expiresAt.toISOString(),
            token: i.token,
            createdAt: i.createdAt.toISOString()
          }))}
          currentUserRole={wsMember.role}
          currentUserId={wsMember.userId}
        />
      )}

      <div className="border-t border-[var(--border)] pt-8">
        <WebhookSettings
          webhooks={webhooks.map(w => ({
            id: w.id,
            name: w.name,
            url: w.url,
            events: w.events,
            active: w.active,
            lastSentAt: w.lastSentAt?.toISOString() ?? null,
            lastStatus: w.lastStatus ?? null,
            lastError: w.lastError ?? null,
            createdAt: w.createdAt.toISOString(),
          }))}
        />
      </div>

      <div className="border-t border-[var(--border)] pt-8">
        <ApiKeySettings
          keys={apiKeys.map(k => ({
            id: k.id,
            name: k.name,
            keyPrefix: k.keyPrefix,
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            expiresAt: k.expiresAt?.toISOString() ?? null,
            createdAt: k.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
