import { db } from "@/lib/db";
import { apiKey } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireWorkspace } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-auth";
import { nanoid } from "nanoid";

export async function GET() {
  const ws = await requireWorkspace();
  const keys = await db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    })
    .from(apiKey)
    .where(eq(apiKey.workspaceId, ws.id))
    .orderBy(desc(apiKey.createdAt));

  return Response.json({ keys });
}

export async function POST(request: Request) {
  const ws = await requireWorkspace();

  const body = (await request.json()) as {
    name: string;
    expiresAt?: string;
  };

  if (!body.name) {
    return Response.json({ error: "name is required." }, { status: 400 });
  }

  const { raw, prefix, hash } = generateApiKey();

  const [created] = await db
    .insert(apiKey)
    .values({
      id: nanoid(),
      workspaceId: ws.id,
      name: body.name,
      keyPrefix: prefix,
      keyHash: hash,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    })
    .returning();

  return Response.json(
    {
      key: {
        id: created.id,
        name: created.name,
        keyPrefix: created.keyPrefix,
        rawKey: raw, // Return the raw key once on creation
        expiresAt: created.expiresAt,
        createdAt: created.createdAt,
      },
    },
    { status: 201 }
  );
}
