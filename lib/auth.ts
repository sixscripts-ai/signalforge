import { auth } from "@clerk/nextjs/server";
import { db } from "./db";
import { workspace, workspaceMember } from "./db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { cookies } from "next/headers";

export async function getCurrentUser() {
  const { userId } = await auth();
  return userId;
}

export async function getCurrentWorkspace() {
  const userId = await getCurrentUser();
  if (!userId) return null;

  const cookieStore = await cookies();
  const activeWorkspaceId = cookieStore.get("activeWorkspaceId")?.value;

  const memberRecords = await db
    .select()
    .from(workspaceMember)
    .where(eq(workspaceMember.userId, userId));

  if (!memberRecords.length) return null;

  let activeMemberRecord = memberRecords[0];
  if (activeWorkspaceId) {
    const found = memberRecords.find((m) => m.workspaceId === activeWorkspaceId);
    if (found) {
      activeMemberRecord = found;
    }
  }

  const wsRecords = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, activeMemberRecord.workspaceId))
    .limit(1);

  return wsRecords[0] || null;
}

export async function getUserWorkspaces() {
  const userId = await getCurrentUser();
  if (!userId) return [];

  const members = await db
    .select({ workspaceId: workspaceMember.workspaceId })
    .from(workspaceMember)
    .where(eq(workspaceMember.userId, userId));

  if (!members.length) return [];

  return db
    .select()
    .from(workspace)
    .where(inArray(workspace.id, members.map((m) => m.workspaceId)));
}

export async function requireWorkspace() {
  const ws = await getCurrentWorkspace();
  if (ws) return ws;

  const userId = await getCurrentUser();
  if (!userId) {
    throw new Error("Unauthorized: User not found");
  }

  // Auto-provision a default workspace
  const newWorkspaceId = nanoid();
  const newWorkspace = {
    id: newWorkspaceId,
    name: "My Workspace",
  };

  await db.insert(workspace).values(newWorkspace);
  await db.insert(workspaceMember).values({
    id: nanoid(),
    workspaceId: newWorkspaceId,
    userId,
    role: "owner",
  });

  return newWorkspace;
}
export async function getWorkspaceMembership() {
  const userId = await getCurrentUser();
  if (!userId) return null;

  const ws = await getCurrentWorkspace();
  if (!ws) return null;

  const exactMemberRecords = await db
    .select()
    .from(workspaceMember)
    .where(
      and(
        eq(workspaceMember.userId, userId),
        eq(workspaceMember.workspaceId, ws.id)
      )
    )
    .limit(1);

  return exactMemberRecords[0] || null;
}

export async function requireWorkspaceRole(allowedRoles: string[]) {
  const membership = await getWorkspaceMembership();
  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new Error("Unauthorized: Insufficient permissions");
  }
  return membership;
}

// Permission Checkers
export function canManageMembers(role: string) {
  return role === "owner" || role === "admin";
}

export function canEditSchemaProfile(role: string) {
  return role === "owner" || role === "admin";
}

export function canImportData(role: string) {
  return role === "owner" || role === "admin" || role === "member";
}
