import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceInvitation } from "@/lib/db/schema";
import { requireWorkspaceRole } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function GET() {
  try {
    const wsMember = await requireWorkspaceRole(["owner", "admin"]);
    const invitations = await db
      .select()
      .from(workspaceInvitation)
      .where(eq(workspaceInvitation.workspaceId, wsMember.workspaceId))
      .orderBy(desc(workspaceInvitation.createdAt));

    return NextResponse.json({ invitations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch invitations" },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const wsMember = await requireWorkspaceRole(["owner", "admin"]);
    const body = await request.json();
    const { email, role } = body;

    if (!email || !role || !["owner", "admin", "member"].includes(role)) {
      return NextResponse.json({ error: "Invalid email or role" }, { status: 400 });
    }

    const token = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const [invitation] = await db
      .insert(workspaceInvitation)
      .values({
        id: nanoid(),
        workspaceId: wsMember.workspaceId,
        email,
        role,
        token,
        status: "pending",
        invitedByUserId: wsMember.userId,
        expiresAt,
      })
      .returning();

    return NextResponse.json({ invitation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create invitation" },
      { status: 401 }
    );
  }
}
