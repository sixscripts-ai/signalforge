import { db } from "./db";
import { importTemplate } from "./db/schema";
import { schemaProfile } from "./db/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  DEFAULT_SCHEMA_PROFILE,
  SchemaProfileConfigSchema,
  type SchemaProfileConfig,
} from "./schema-profile";

// ── Types ───────────────────────────────────────────────────────

export type ImportTemplateInput = {
  name: string;
  description?: string;
  schemaProfileId?: string | null;
  config: SchemaProfileConfig;
  sampleHeaders?: string[] | null;
  isDefault?: boolean;
};

export type ImportTemplateUpdate = {
  name?: string;
  description?: string | null;
  schemaProfileId?: string | null;
  config?: SchemaProfileConfig;
  sampleHeaders?: string[] | null;
  isDefault?: boolean;
};

export type ImportTemplateSnapshot = {
  templateId: string;
  templateName: string;
  config: SchemaProfileConfig;
};

// ── Read Helpers ─────────────────────────────────────────────────

export async function getImportTemplates(workspaceId: string) {
  return db
    .select()
    .from(importTemplate)
    .where(eq(importTemplate.workspaceId, workspaceId))
    .orderBy(desc(importTemplate.isDefault), desc(importTemplate.createdAt));
}

export async function getImportTemplateById(workspaceId: string, templateId: string) {
  const row = await db
    .select()
    .from(importTemplate)
    .where(and(eq(importTemplate.id, templateId), eq(importTemplate.workspaceId, workspaceId)))
    .limit(1)
    .then((res) => res[0] || null);
  return row ?? null;
}

export async function getDefaultImportTemplate(workspaceId: string) {
  const row = await db
    .select()
    .from(importTemplate)
    .where(and(eq(importTemplate.workspaceId, workspaceId), eq(importTemplate.isDefault, "true")))
    .limit(1)
    .then((res) => res[0] || null);
  return row ?? null;
}

// ── Write Helpers ────────────────────────────────────────────────

export async function createImportTemplate(
  workspaceId: string,
  input: ImportTemplateInput,
  createdByUserId: string,
) {
  const id = nanoid();
  const now = new Date();

  // If setting as default, unset any existing default first
  if (input.isDefault) {
    await unsetDefaultTemplates(workspaceId);
  }

  await db.insert(importTemplate).values({
    id,
    workspaceId,
    name: input.name,
    description: input.description ?? null,
    schemaProfileId: input.schemaProfileId ?? null,
    config: input.config,
    sampleHeaders: input.sampleHeaders ?? null,
    isDefault: input.isDefault ? "true" : "false",
    createdByUserId,
    createdAt: now,
    updatedAt: now,
  });

  return getImportTemplateById(workspaceId, id);
}

export async function updateImportTemplate(
  workspaceId: string,
  templateId: string,
  input: ImportTemplateUpdate,
) {
  // Verify ownership
  const existing = await getImportTemplateById(workspaceId, templateId);
  if (!existing) return null;

  const now = new Date();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.schemaProfileId !== undefined) updateData.schemaProfileId = input.schemaProfileId;
  if (input.config !== undefined) updateData.config = input.config;
  if (input.sampleHeaders !== undefined) updateData.sampleHeaders = input.sampleHeaders;
  if (input.isDefault !== undefined) {
    if (input.isDefault) {
      await unsetDefaultTemplates(workspaceId);
    }
    updateData.isDefault = input.isDefault ? "true" : "false";
  }

  const [updated] = await db
    .update(importTemplate)
    .set(updateData)
    .where(and(eq(importTemplate.id, templateId), eq(importTemplate.workspaceId, workspaceId)))
    .returning();

  return updated ?? null;
}

export async function deleteImportTemplate(workspaceId: string, templateId: string) {
  const existing = await getImportTemplateById(workspaceId, templateId);
  if (!existing) return false;

  await db
    .delete(importTemplate)
    .where(and(eq(importTemplate.id, templateId), eq(importTemplate.workspaceId, workspaceId)));

  return true;
}

// ── Config Resolution ───────────────────────────────────────────

/**
 * Resolve the final SchemaProfileConfig to use for an import.
 *
 * Precedence:
 *   1. If a templateId is given, use that template's stored config (which was
 *      already resolved from its source schema profile at create/update time).
 *   2. Otherwise, if a schemaProfileId is given, load and parse that profile.
 *   3. Otherwise, load the latest schema profile for the workspace.
 *   4. Fall back to DEFAULT_SCHEMA_PROFILE.
 *
 * Returns the resolved config and an optional template snapshot for audit storage.
 */
export async function resolveImportConfig(opts: {
  workspaceId: string;
  schemaProfileId?: string | null;
  templateId?: string | null;
}): Promise<{
  config: SchemaProfileConfig;
  templateSnapshot: ImportTemplateSnapshot | null;
}> {
  const { workspaceId, templateId, schemaProfileId } = opts;

  // 1. Template overrides everything
  if (templateId) {
    const tmpl = await getImportTemplateById(workspaceId, templateId);
    if (tmpl) {
      const storedConfig = tmpl.config as SchemaProfileConfig;
      const parsed = SchemaProfileConfigSchema.safeParse(storedConfig);
      if (parsed.success) {
        return {
          config: parsed.data,
          templateSnapshot: {
            templateId: tmpl.id,
            templateName: tmpl.name,
            config: parsed.data,
          },
        };
      }
    }
  }

  // 2. Specific schema profile
  if (schemaProfileId) {
    const rec = await db
      .select()
      .from(schemaProfile)
      .where(and(eq(schemaProfile.id, schemaProfileId), eq(schemaProfile.workspaceId, workspaceId)))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (rec) {
      const parsed = SchemaProfileConfigSchema.safeParse(rec);
      if (parsed.success) {
        return { config: parsed.data, templateSnapshot: null };
      }
    }
  }

  // 3. Latest profile for workspace
  const latest = await db
    .select()
    .from(schemaProfile)
    .where(eq(schemaProfile.workspaceId, workspaceId))
    .orderBy(desc(schemaProfile.createdAt))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (latest) {
    const parsed = SchemaProfileConfigSchema.safeParse(latest);
    if (parsed.success) {
      return { config: parsed.data, templateSnapshot: null };
    }
  }

  // 4. Fallback
  return { config: DEFAULT_SCHEMA_PROFILE, templateSnapshot: null };
}

// ── Internal Helpers ─────────────────────────────────────────────

async function unsetDefaultTemplates(workspaceId: string) {
  await db
    .update(importTemplate)
    .set({ isDefault: "false", updatedAt: new Date() })
    .where(and(eq(importTemplate.workspaceId, workspaceId), eq(importTemplate.isDefault, "true")));
}
