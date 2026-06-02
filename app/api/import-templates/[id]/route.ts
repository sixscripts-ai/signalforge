import { requireWorkspace, getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { currentUser } from "@clerk/nextjs/server";
import {
  getImportTemplateById,
  updateImportTemplate,
  deleteImportTemplate,
} from "@/lib/import-templates";
import { SchemaProfileConfigSchema, type SchemaProfileConfig } from "@/lib/schema-profile";
import { db } from "@/lib/db";
import { schemaProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// ── GET ──────────────────────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ws = await requireWorkspace();
  const { id } = await params;

  const template = await getImportTemplateById(ws.id, id);
  if (!template) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Template not found." } }, { status: 404 });
  }

  return Response.json(template);
}

// ── UPDATE ───────────────────────────────────────────────────────
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ws = await requireWorkspace();
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "Invalid JSON body." } }, { status: 400 });
  }

  const template = await getImportTemplateById(ws.id, id);
  if (!template) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Template not found." } }, { status: 404 });
  }

  const { name, description, schemaProfileId, config, isDefault } = body as {
    name?: string;
    description?: string | null;
    schemaProfileId?: string | null;
    config?: unknown;
    isDefault?: boolean;
  };

  // Validate config if provided
  if (config) {
    const parsed = SchemaProfileConfigSchema.safeParse(config);
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid template configuration.", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }
  }

  // Validate name
  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Template name cannot be empty." } }, { status: 400 });
  }

  // Resolve config: use validated parsed data, or load from profile if profile changed
  let resolvedConfig: SchemaProfileConfig | undefined = undefined;

  if (config) {
    const parsed = SchemaProfileConfigSchema.safeParse(config);
    if (parsed.success) {
      resolvedConfig = parsed.data;
    }
  } else if (schemaProfileId !== undefined && schemaProfileId !== template.schemaProfileId) {
    if (schemaProfileId) {
      const profile = await db
        .select()
        .from(schemaProfile)
        .where(eq(schemaProfile.id, schemaProfileId))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!profile) {
        return Response.json(
          { error: { code: "NOT_FOUND", message: "Schema profile not found." } },
          { status: 404 },
        );
      }

      const parsed = SchemaProfileConfigSchema.safeParse(profile);
      if (parsed.success) {
        resolvedConfig = parsed.data;
      }
    }
  }

  const updated = await updateImportTemplate(ws.id, id, {
    name: name?.trim(),
    description,
    schemaProfileId,
    config: resolvedConfig,
    isDefault,
  });

  if (!updated) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Template not found." } }, { status: 404 });
  }

  // Audit
  const userId = await getCurrentUser();
  const user = await currentUser();
  createAuditLog({
    workspaceId: ws.id,
    actorUserId: userId ?? "unknown",
    actorEmail: user?.emailAddresses[0]?.emailAddress ?? undefined,
    action: "import_template.updated",
    entityType: "import_template",
    entityId: id,
    summary: `Updated import template "${updated.name}"`,
    metadata: {
      templateName: updated.name,
      wasDefaultChanged: isDefault !== undefined,
      isDefault: updated.isDefault,
    },
  });

  return Response.json(updated);
}

// ── DELETE ───────────────────────────────────────────────────────
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ws = await requireWorkspace();
  const { id } = await params;

  const template = await getImportTemplateById(ws.id, id);
  if (!template) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Template not found." } }, { status: 404 });
  }

  const deleted = await deleteImportTemplate(ws.id, id);
  if (!deleted) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Template not found." } }, { status: 404 });
  }

  // Audit
  const userId = await getCurrentUser();
  const user = await currentUser();
  createAuditLog({
    workspaceId: ws.id,
    actorUserId: userId ?? "unknown",
    actorEmail: user?.emailAddresses[0]?.emailAddress ?? undefined,
    action: "import_template.deleted",
    entityType: "import_template",
    entityId: id,
    summary: `Deleted import template "${template.name}"`,
    metadata: { templateName: template.name },
  });

  return Response.json({ success: true });
}
