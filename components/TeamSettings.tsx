"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = {
  id: string;
  userId: string;
  email?: string;
  role: string;
  createdAt: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  token: string;
  createdAt: string;
};

type TeamSettingsProps = {
  members: Member[];
  invitations: Invitation[];
  currentUserRole: string;
  currentUserId: string;
};

export default function TeamSettings({ members, invitations, currentUserRole, currentUserId }: TeamSettingsProps) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const res = await fetch("/api/workspace/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        setInviteError(data.error || "Failed to invite user");
      } else {
        const inviteLink = `${window.location.origin}/invite/${data.invitation.token}`;
        setInviteSuccess(`Invitation created! Link: ${inviteLink}`);
        setInviteEmail("");
        router.refresh();
      }
    } catch {
      setInviteError("An error occurred");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!canManage) return;
    if (!confirm("Are you sure you want to revoke this invitation?")) return;

    try {
      await fetch(`/api/workspace/invitations/${id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      alert("Failed to revoke invitation");
    }
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    if (!canManage) return;

    try {
      const res = await fetch(`/api/workspace/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update role");
      } else {
        router.refresh();
      }
    } catch {
      alert("An error occurred");
    }
  };

  const handleRemoveMember = async (id: string) => {
    if (!canManage) return;
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const res = await fetch(`/api/workspace/members/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to remove member");
      } else {
        router.refresh();
      }
    } catch {
      alert("An error occurred");
    }
  };

  return (
    <div className="space-y-8 border-t border-[var(--border)] pt-8 mt-8">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text)]">Team Management</h3>
        <p className="text-sm text-[var(--muted)]">Manage workspace members and invitations.</p>
      </div>

      {canManage && (
        <form onSubmit={handleInvite} className="bg-[var(--panel-soft)] border border-[var(--border)] rounded-xl p-4 space-y-4">
          <h4 className="text-sm font-semibold">Invite Member</h4>
          {inviteError && <p className="text-red-500 text-sm">{inviteError}</p>}
          {inviteSuccess && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-500 p-2 text-sm rounded break-all">
              {inviteSuccess}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              required
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            <button
              type="submit"
              disabled={isInviting}
              className="bg-[var(--accent)] text-[var(--bg)] px-4 py-2 rounded text-sm font-medium hover:bg-[var(--accent-hover)] transition disabled:opacity-50"
            >
              {isInviting ? "Inviting..." : "Invite"}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        <h4 className="text-sm font-semibold">Active Members</h4>
        <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--panel)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--panel-soft)] border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 font-medium text-[var(--muted)]">User ID</th>
                <th className="px-4 py-3 font-medium text-[var(--muted)]">Role</th>
                <th className="px-4 py-3 font-medium text-[var(--muted)]">Joined</th>
                {canManage && <th className="px-4 py-3 font-medium text-[var(--muted)] text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3">{member.userId} {member.userId === currentUserId && "(You)"}</td>
                  <td className="px-4 py-3">
                    {canManage && member.userId !== currentUserId ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        className="bg-transparent border border-[var(--border)] rounded px-2 py-1 outline-none text-sm focus:border-[var(--accent)]"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </select>
                    ) : (
                      <span className="capitalize">{member.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {member.userId !== currentUserId && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-red-500 hover:text-red-400 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {canManage && invitations.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">Pending Invitations</h4>
          <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--panel)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--panel-soft)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3 font-medium text-[var(--muted)]">Email</th>
                  <th className="px-4 py-3 font-medium text-[var(--muted)]">Role</th>
                  <th className="px-4 py-3 font-medium text-[var(--muted)]">Status</th>
                  <th className="px-4 py-3 font-medium text-[var(--muted)] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3">{inv.email}</td>
                    <td className="px-4 py-3 capitalize">{inv.role}</td>
                    <td className="px-4 py-3 capitalize text-[var(--muted)]">{inv.status}</td>
                    <td className="px-4 py-3 text-right">
                      {inv.status === "pending" && (
                        <button
                          onClick={() => handleRevoke(inv.id)}
                          className="text-red-500 hover:text-red-400 text-sm"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
