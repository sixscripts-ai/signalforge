import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceInvitation } from "@/lib/db/schema";
import { requireWorkspaceRole, getCurrentUser } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "@/lib/audit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const wsMember = await requireWorkspaceRole(["owner", "admin"]);
    const { id } = await params;

    const [updated] = await db
      .update(workspaceInvitation)
      .set({ status: "revoked" })
      .where(
        and(
          eq(workspaceInvitation.id, id),
          eq(workspaceInvitation.workspaceId, wsMember.workspaceId),
          eq(workspaceInvitation.status, "pending")
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Invitation not found or not pending" }, { status: 404 });
    }

    const userId = await getCurrentUser();
    const user = await currentUser();
    createAuditLog({
      workspaceId: wsMember.workspaceId,
      actorUserId: userId ?? wsMember.userId,
      actorEmail: user?.emailAddresses[0]?.emailAddress ?? undefined,
      action: "invitation.revoked",
      entityType: "invitation",
      entityId: id,
      summary: `Revoked invitation for ${updated.email}`,
      metadata: { email: updated.email, role: updated.role },
    });

    return NextResponse.json({ invitation: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revoke invitation" },
      { status: 401 }
    );
  }
}
