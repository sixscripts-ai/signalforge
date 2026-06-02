import { requireWorkspace, getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { currentUser } from "@clerk/nextjs/server";
import { getImportTemplates, getDefaultImportTemplate, createImportTemplate } from "@/lib/import-templates";
import { SchemaProfileConfigSchema } from "@/lib/schema-profile";
import { db } from "@/lib/db";
import { schemaProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// ── LIST ─────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const ws = await requireWorkspace();

  const { searchParams } = new URL(request.url);
  const defaultOnly = searchParams.get("default") === "true";

  if (defaultOnly) {
    const tmpl = await getDefaultImportTemplate(ws.id);
    return Response.json(tmpl);
  }

  const templates = await getImportTemplates(ws.id);
  return Response.json(templates);
}

// ── CREATE ───────────────────────────────────────────────────────
export async function POST(request: Request) {
  const ws = await requireWorkspace();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "Invalid JSON body." } }, { status: 400 });
  }

  const { name, description, schemaProfileId, config, isDefault } = body as {
    name?: string;
    description?: string;
    schemaProfileId?: string | null;
    config?: unknown;
    isDefault?: boolean;
  };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: { code: "MISSING_FIELDS", message: "Template name is required." } }, { status: 400 });
  }

  // Validate config or build from schema profile
  let resolvedConfig = config;
  if (!resolvedConfig && schemaProfileId) {
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
    resolvedConfig = profile;
  }

  if (!resolvedConfig) {
    return Response.json(
      { error: { code: "MISSING_FIELDS", message: "A config or schemaProfileId is required." } },
      { status: 400 },
    );
  }

  const parsed = SchemaProfileConfigSchema.safeParse(resolvedConfig);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid template configuration.", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const userId = await getCurrentUser();
  if (!userId) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "User not found." } }, { status: 401 });
  }

  const template = await createImportTemplate(
    ws.id,
    {
      name: name.trim(),
      description: description ?? "",
      schemaProfileId: schemaProfileId ?? null,
      config: parsed.data,
      isDefault: isDefault ?? false,
    },
    userId,
  );

  // Audit
  const user = await currentUser();
  createAuditLog({
    workspaceId: ws.id,
    actorUserId: userId,
    actorEmail: user?.emailAddresses[0]?.emailAddress ?? undefined,
    action: "import_template.created",
    entityType: "import_template",
    entityId: template?.id,
    summary: `Created import template "${name.trim()}"`,
    metadata: { templateName: name.trim(), schemaProfileId: schemaProfileId ?? null },
  });

  return Response.json(template, { status: 201 });
}
