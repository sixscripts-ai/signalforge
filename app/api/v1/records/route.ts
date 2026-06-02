import { db } from "@/lib/db";
import { normalizedRecord } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireApiKey, ApiKeyError } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    const workspaceId = await requireApiKey(request);

    const records = await db
      .select()
      .from(normalizedRecord)
      .where(eq(normalizedRecord.workspaceId, workspaceId))
      .orderBy(desc(normalizedRecord.createdAt))
      .limit(200);

    return Response.json({ records });
  } catch (error) {
    if (error instanceof ApiKeyError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}
