import { db } from "@/lib/db";
import { webhook } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireWorkspace } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ws = await requireWorkspace();

  const existing = await db
    .select()
    .from(webhook)
    .where(and(eq(webhook.id, id), eq(webhook.workspaceId, ws.id)))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    return Response.json({ error: "Webhook not found." }, { status: 404 });
  }

  const body = (await request.json()) as {
    name?: string;
    url?: string;
    events?: string[];
    active?: string;
  };

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.url !== undefined) {
    try {
      new URL(body.url);
      updates.url = body.url;
    } catch {
      return Response.json({ error: "Invalid URL." }, { status: 400 });
    }
  }
  if (body.events !== undefined) {
    const validEvents = ["import.completed", "import.failed", "import.started", "*"];
    for (const event of body.events) {
      if (!validEvents.includes(event)) {
        return Response.json(
          { error: `Invalid event: ${event}` },
          { status: 400 }
        );
      }
    }
    updates.events = body.events;
  }
  if (body.active !== undefined) {
    if (body.active !== "true" && body.active !== "false") {
      return Response.json({ error: "active must be 'true' or 'false'." }, { status: 400 });
    }
    updates.active = body.active;
  }

  if (!Object.keys(updates).length) {
    return Response.json({ error: "No valid fields to update." }, { status: 400 });
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(webhook)
    .set(updates)
    .where(eq(webhook.id, id))
    .returning();

  return Response.json({
    webhook: { ...updated, signingSecret: "[REDACTED]" },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ws = await requireWorkspace();

  const existing = await db
    .select()
    .from(webhook)
    .where(and(eq(webhook.id, id), eq(webhook.workspaceId, ws.id)))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    return Response.json({ error: "Webhook not found." }, { status: 404 });
  }

  await db.delete(webhook).where(eq(webhook.id, id));

  return Response.json({ success: true });
}
