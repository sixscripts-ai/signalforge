import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceMember } from "@/lib/db/schema";
import { requireWorkspaceRole } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

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

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove member" },
      { status: 401 }
    );
  }
}
