import { db } from "@/lib/db";
import { webhook } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireWorkspace } from "@/lib/auth";
import { nanoid } from "nanoid";
import { randomBytes } from "node:crypto";

export async function GET() {
  const ws = await requireWorkspace();
  const hooks = await db
    .select()
    .from(webhook)
    .where(eq(webhook.workspaceId, ws.id))
    .orderBy(desc(webhook.createdAt));

  // Strip signing secrets from response
  const sanitized = hooks.map((h) => ({
    ...h,
    signingSecret: h.signingSecret ? "[REDACTED]" : null,
  }));

  return Response.json({ webhooks: sanitized });
}

export async function POST(request: Request) {
  const ws = await requireWorkspace();

  const body = (await request.json()) as {
    name: string;
    url: string;
    events: string[];
  };

  if (!body.name || !body.url || !body.events?.length) {
    return Response.json(
      { error: "name, url, and events are required." },
      { status: 400 }
    );
  }

  // Validate URL
  try {
    new URL(body.url);
  } catch {
    return Response.json({ error: "Invalid URL." }, { status: 400 });
  }

  // Validate events
  const validEvents = [
    "import.completed",
    "import.failed",
    "import.started",
    "*",
  ];
  for (const event of body.events) {
    if (!validEvents.includes(event)) {
      return Response.json(
        { error: `Invalid event: ${event}. Valid: ${validEvents.join(", ")}` },
        { status: 400 }
      );
    }
  }

  const signingSecret = randomBytes(32).toString("hex");

  const [created] = await db
    .insert(webhook)
    .values({
      id: nanoid(),
      workspaceId: ws.id,
      name: body.name,
      url: body.url,
      signingSecret,
      events: body.events,
      active: "true",
    })
    .returning();

  return Response.json(
    {
      webhook: {
        ...created,
        signingSecret, // Return raw secret once on creation
      },
    },
    { status: 201 }
  );
}
