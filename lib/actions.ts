"use server";

import { cookies } from "next/headers";

export async function setActiveWorkspaceAction(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set("activeWorkspaceId", workspaceId, { path: "/" });
}
