import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceMember } from "@/lib/db/schema";
import { requireWorkspaceRole, getCurrentUser } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const wsMember = await requireWorkspaceRole(["owner", "admin"]);
    const { id } = await params;
    const body = await request.json();
    const { role } = body;

    if (!["owner", "admin", "member"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Owner check: cannot demote final owner
    if (role !== "owner") {
      const owners = await db
        .select()
        .from(workspaceMember)
        .where(
          and(
            eq(workspaceMember.workspaceId, wsMember.workspaceId),
            eq(workspaceMember.role, "owner")
          )
        );

      if (owners.length === 1 && owners[0].id === id) {
        return NextResponse.json(
          { error: "Cannot demote the final owner of the workspace." },
          { status: 400 }
        );
      }
    }

    // Fetch the old member record for audit diff
    const oldMember = await db
      .select()
      .from(workspaceMember)
      .where(
        and(
          eq(workspaceMember.id, id),
          eq(workspaceMember.workspaceId, wsMember.workspaceId)
        )
      )
      .limit(1)
      .then((r) => r[0]);

    const [updated] = await db
      .update(workspaceMember)
      .set({ role })
      .where(
        and(
          eq(workspaceMember.id, id),
          eq(workspaceMember.workspaceId, wsMember.workspaceId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const userId = await getCurrentUser();
    const user = await currentUser();
    createAuditLog({
      workspaceId: wsMember.workspaceId,
      actorUserId: userId ?? wsMember.userId,
      actorEmail: user?.emailAddresses[0]?.emailAddress ?? undefined,
      action: "member.role_changed",
      entityType: "member",
      entityId: id,
      summary: `Changed member role from "${oldMember?.role}" to "${role}"`,
      metadata: { memberId: id, oldRole: oldMember?.role, newRole: role },
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update member" },
      { status: 401 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const wsMember = await requireWorkspaceRole(["owner", "admin"]);
    const { id } = await params;

    // Check if target is final owner
    const target = await db
      .select()
      .from(workspaceMember)
      .where(
        and(
          eq(workspaceMember.id, id),
          eq(workspaceMember.workspaceId, wsMember.workspaceId)
        )
      )
      .limit(1);

    if (!target.length) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (target[0].role === "owner") {
      const owners = await db
        .select()
        .from(workspaceMember)
        .where(
          and(
            eq(workspaceMember.workspaceId, wsMember.workspaceId),
            eq(workspaceMember.role, "owner")
          )
        );

      if (owners.length === 1) {
        return NextResponse.json(
          { error: "Cannot remove the final owner of the workspace." },
          { status: 400 }
        );
      }
    }

    await db
      .delete(workspaceMember)
      .where(
        and(
          eq(workspaceMember.id, id),
          eq(workspaceMember.workspaceId, wsMember.workspaceId)
        )
      );

    const userId = await getCurrentUser();
    const user = await currentUser();
    createAuditLog({
      workspaceId: wsMember.workspaceId,
      actorUserId: userId ?? wsMember.userId,
      actorEmail: user?.emailAddresses[0]?.emailAddress ?? undefined,
      action: "member.removed",
      entityType: "member",
      entityId: id,
      summary: `Removed member (role: ${target[0].role})`,
      metadata: { memberId: id, role: target[0].role, userId: target[0].userId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove member" },
      { status: 401 }
    );
  }
}
