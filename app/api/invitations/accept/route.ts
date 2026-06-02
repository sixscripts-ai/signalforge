import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceInvitation, workspaceMember } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const invitations = await db
      .select()
      .from(workspaceInvitation)
      .where(
        and(
          eq(workspaceInvitation.token, token),
          eq(workspaceInvitation.status, "pending")
        )
      )
      .limit(1);

    if (!invitations.length) {
      return NextResponse.json({ error: "Invalid or revoked invitation" }, { status: 400 });
    }

    const invitation = invitations[0];

    if (new Date(invitation.expiresAt) < new Date()) {
      await db
        .update(workspaceInvitation)
        .set({ status: "expired" })
        .where(eq(workspaceInvitation.id, invitation.id));

      return NextResponse.json({ error: "Invitation has expired" }, { status: 400 });
    }

    const emailAddress = user.emailAddresses.find((e) => e.emailAddress === invitation.email);
    if (!emailAddress) {
      return NextResponse.json(
        { error: `This invitation was sent to ${invitation.email}, but you are signed in with a different email.` },
        { status: 400 }
      );
    }

    // Check if user is already a member
    const existingMember = await db
      .select()
      .from(workspaceMember)
      .where(
        and(
          eq(workspaceMember.workspaceId, invitation.workspaceId),
          eq(workspaceMember.userId, userId)
        )
      )
      .limit(1);

    if (existingMember.length) {
      return NextResponse.json({ error: "You are already a member of this workspace" }, { status: 400 });
    }

    // Add user to workspace
    await db.insert(workspaceMember).values({
      id: nanoid(),
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
    });

    // Mark invitation as accepted
    await db
      .update(workspaceInvitation)
      .set({
        status: "accepted",
        acceptedByUserId: userId,
      })
      .where(eq(workspaceInvitation.id, invitation.id));

    // Return the workspace ID to the client so it can set the active workspace cookie
    return NextResponse.json({ workspaceId: invitation.workspaceId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
