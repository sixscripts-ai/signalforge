import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schemaProfile } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { SchemaProfileConfigSchema, DEFAULT_SCHEMA_PROFILE } from "@/lib/schema-profile";
import { requireWorkspace, requireWorkspaceRole, getCurrentUser } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const ws = await requireWorkspace();
    
    const profileRecord = await db
      .select()
      .from(schemaProfile)
      .where(eq(schemaProfile.workspaceId, ws.id))
      .orderBy(desc(schemaProfile.createdAt))
      .limit(1)
      .then((res) => res[0] || null);

    if (!profileRecord) {
      return NextResponse.json(DEFAULT_SCHEMA_PROFILE);
    }

    return NextResponse.json({
      id: profileRecord.id,
      name: profileRecord.name,
      requiredFields: profileRecord.requiredFields,
      fieldMappings: profileRecord.fieldMappings,
      cleanupRules: profileRecord.cleanupRules,
      validationRules: profileRecord.validationRules,
      dedupeStrategy: profileRecord.dedupeStrategy,
    });
  } catch (error) {
    console.error("GET /api/schema-profile error:", error);
    return NextResponse.json({ error: { code: "FETCH_FAILED", message: "Failed to fetch profile" } }, { status: 500 });
  }
}

function computeChangedSections(
  old: Record<string, unknown>,
  updated: Record<string, unknown>
): string[] {
  const sections: { key: string; label: string }[] = [
    { key: "requiredFields", label: "required fields" },
    { key: "fieldMappings", label: "field mappings" },
    { key: "cleanupRules", label: "cleanup rules" },
    { key: "validationRules", label: "validation rules" },
    { key: "dedupeStrategy", label: "dedupe strategy" },
  ];
  return sections
    .filter((s) => JSON.stringify(old[s.key]) !== JSON.stringify(updated[s.key]))
    .map((s) => s.label);
}

export async function PUT(req: NextRequest) {
  try {
    const wsMember = await requireWorkspaceRole(["owner", "admin"]);
    const ws = { id: wsMember.workspaceId };
    const body = await req.json();
    const parsed = SchemaProfileConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: { code: "INVALID_SCHEMA_PROFILE", message: "Invalid schema profile", issues: parsed.error.issues } }, { status: 400 });
    }

    const data = parsed.data;
    let profileName = data.name;
    let changedSections: string[] = [];
    const userId = await getCurrentUser();
    const user = await currentUser();

    // We update or insert the top profile. If id is provided, update it.
    if (data.id) {
      // Fetch old record for diff
      const oldRecord = await db
        .select()
        .from(schemaProfile)
        .where(and(eq(schemaProfile.id, data.id), eq(schemaProfile.workspaceId, ws.id)))
        .limit(1)
        .then((r) => r[0]);

      if (oldRecord) {
        changedSections = computeChangedSections(
          oldRecord as unknown as Record<string, unknown>,
          data as unknown as Record<string, unknown>
        );
        profileName = oldRecord.name;
      }

      await db.update(schemaProfile)
        .set({
          name: data.name,
          requiredFields: data.requiredFields,
          fieldMappings: data.fieldMappings,
          cleanupRules: data.cleanupRules,
          validationRules: data.validationRules,
          dedupeStrategy: data.dedupeStrategy,
          updatedAt: new Date(),
        })
        .where(and(eq(schemaProfile.id, data.id), eq(schemaProfile.workspaceId, ws.id)));
      
      createAuditLog({
        workspaceId: ws.id,
        actorUserId: userId ?? "unknown",
        actorEmail: user?.emailAddresses[0]?.emailAddress ?? undefined,
        action: "schema_profile.updated",
        entityType: "schema_profile",
        entityId: data.id,
        summary: `Updated schema profile "${profileName}"`,
        metadata: { profileName, changedSections: changedSections.length > 0 ? changedSections : undefined },
      });

      return NextResponse.json(data);
    } else {
      // Find the most recent one or create
      const existing = await db.select().from(schemaProfile).where(eq(schemaProfile.workspaceId, ws.id)).orderBy(desc(schemaProfile.createdAt)).limit(1).then(r => r[0]);
      
      if (existing) {
        changedSections = computeChangedSections(
          existing as unknown as Record<string, unknown>,
          data as unknown as Record<string, unknown>
        );
        profileName = existing.name;

        await db.update(schemaProfile)
          .set({
            name: data.name,
            requiredFields: data.requiredFields,
            fieldMappings: data.fieldMappings,
            cleanupRules: data.cleanupRules,
            validationRules: data.validationRules,
            dedupeStrategy: data.dedupeStrategy,
            updatedAt: new Date(),
          })
          .where(eq(schemaProfile.id, existing.id));
        
        createAuditLog({
          workspaceId: ws.id,
          actorUserId: userId ?? "unknown",
          actorEmail: user?.emailAddresses[0]?.emailAddress ?? undefined,
          action: "schema_profile.updated",
          entityType: "schema_profile",
          entityId: existing.id,
          summary: `Updated schema profile "${profileName}"`,
          metadata: { profileName, changedSections: changedSections.length > 0 ? changedSections : undefined },
        });

        return NextResponse.json({ ...data, id: existing.id });
      } else {
        const id = nanoid();
        await db.insert(schemaProfile).values({
          id,
          workspaceId: ws.id,
          name: data.name,
          requiredFields: data.requiredFields,
          fieldMappings: data.fieldMappings,
          cleanupRules: data.cleanupRules,
          validationRules: data.validationRules,
          dedupeStrategy: data.dedupeStrategy,
        });

        // First-time profile creation — still log as "updated" since there's always a default
        createAuditLog({
          workspaceId: ws.id,
          actorUserId: userId ?? "unknown",
          actorEmail: user?.emailAddresses[0]?.emailAddress ?? undefined,
          action: "schema_profile.updated",
          entityType: "schema_profile",
          entityId: id,
          summary: `Created schema profile "${data.name}"`,
          metadata: { profileName: data.name },
        });

        return NextResponse.json({ ...data, id });
      }
    }
  } catch (error) {
    console.error("PUT /api/schema-profile error:", error);
    return NextResponse.json({ error: { code: "UPDATE_FAILED", message: "Failed to update profile" } }, { status: 500 });
  }
}
