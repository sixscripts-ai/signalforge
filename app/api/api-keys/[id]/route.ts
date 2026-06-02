import { db } from "@/lib/db";
import { apiKey } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireWorkspace } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ws = await requireWorkspace();

  const existing = await db
    .select()
    .from(apiKey)
    .where(and(eq(apiKey.id, id), eq(apiKey.workspaceId, ws.id)))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    return Response.json({ error: "API key not found." }, { status: 404 });
  }

  await db.delete(apiKey).where(eq(apiKey.id, id));

  return Response.json({ success: true });
}
