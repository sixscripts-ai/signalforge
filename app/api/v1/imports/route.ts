import { db } from "@/lib/db";
import { importJob } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireApiKey, ApiKeyError } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    const workspaceId = await requireApiKey(request);

    const imports = await db
      .select()
      .from(importJob)
      .where(eq(importJob.workspaceId, workspaceId))
      .orderBy(desc(importJob.createdAt))
      .limit(100);

    return Response.json({ imports });
  } catch (error) {
    if (error instanceof ApiKeyError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}
