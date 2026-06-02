import { parseImportFile } from "@/lib/parser";
import { processRows } from "@/lib/pipeline";
import { MAX_ROW_COUNT, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { db } from "@/lib/db";
import { schemaProfile } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { DEFAULT_SCHEMA_PROFILE, SchemaProfileConfigSchema } from "@/lib/schema-profile";
import { requireWorkspace, getCurrentUser } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";
import { createAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: { code: "MISSING_FILE", message: "File is required." } }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: { code: "FILE_TOO_LARGE", message: `File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit.` } },
      { status: 413 }
    );
  }

  const content = await file.text();

  let parsed;
  try {
    parsed = parseImportFile({
      filename: file.name,
      content,
      mimeType: file.type,
      maxRows: MAX_ROW_COUNT,
    });
  } catch (error) {
    return Response.json(
      { error: { code: "PARSE_ERROR", message: error instanceof Error ? error.message : "Parse failed." } },
      { status: 400 }
    );
  }

  let ws;
  let profileRecord;
  try {
    ws = await requireWorkspace();
    profileRecord = await db
      .select()
      .from(schemaProfile)
      .where(eq(schemaProfile.workspaceId, ws.id))
      .orderBy(desc(schemaProfile.createdAt))
      .limit(1)
      .then((res) => res[0] || null);
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: { code: "DB_ERROR", message: "Failed to load schema profile." } },
      { status: 500 }
    );
  }

  const profile = profileRecord
    ? SchemaProfileConfigSchema.parse(profileRecord)
    : DEFAULT_SCHEMA_PROFILE;

  const { rows, summary } = processRows(parsed.rows, undefined, profile);

  // Audit: log preview (non-blocking)
  const userId = await getCurrentUser();
  const user = await currentUser();
  if (ws) {
    createAuditLog({
      workspaceId: ws.id,
      actorUserId: userId ?? "unknown",
      actorEmail: user?.emailAddresses[0]?.emailAddress ?? undefined,
      action: "import.previewed",
      entityType: "import",
      summary: `Previewed "${file.name}" — ${summary.total} rows (${summary.valid} valid, ${summary.rejected} rejected)`,
      metadata: {
        filename: file.name,
        totalRows: summary.total,
        validRows: summary.valid,
        autoFixedRows: summary.autoFixed,
        rejectedRows: summary.rejected,
        duplicateRows: summary.duplicate,
      },
    });
  }

  return Response.json({
    filename: file.name,
    sourceType: parsed.sourceType,
    columns: parsed.columns,
    schemaProfileName: profile.name,
    rows,
    summary,
    warnings: parsed.warnings ?? [],
  });
}
