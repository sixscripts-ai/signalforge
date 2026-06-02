import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schemaProfile } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { SchemaProfileConfigSchema, DEFAULT_SCHEMA_PROFILE } from "@/lib/schema-profile";

import { requireWorkspace, requireWorkspaceRole } from "@/lib/auth";

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
    
    // We update or insert the top profile. If id is provided, update it.
    if (data.id) {
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
      
      return NextResponse.json(data);
    } else {
      // Find the most recent one or create
      const existing = await db.select().from(schemaProfile).where(eq(schemaProfile.workspaceId, ws.id)).orderBy(desc(schemaProfile.createdAt)).limit(1).then(r => r[0]);
      
      if (existing) {
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
        return NextResponse.json({ ...data, id });
      }
    }
  } catch (error) {
    console.error("PUT /api/schema-profile error:", error);
    return NextResponse.json({ error: { code: "UPDATE_FAILED", message: "Failed to update profile" } }, { status: 500 });
  }
}
