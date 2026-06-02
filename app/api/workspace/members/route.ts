import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceMember } from "@/lib/db/schema";
import { requireWorkspaceRole } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const wsMember = await requireWorkspaceRole(["owner", "admin", "member"]);
    const members = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.workspaceId, wsMember.workspaceId))
      .orderBy(desc(workspaceMember.createdAt));

    return NextResponse.json({ members });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch members" },
      { status: 401 }
    );
  }
}
