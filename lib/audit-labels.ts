// ── Action Labels (for UI display) ──────────────────────────────
// Extracted to a separate file so client components can import it
// without pulling in the DB dependency.

const actionLabels: Record<string, string> = {
  "workspace.created": "Workspace Created",
  "workspace.updated": "Workspace Updated",
  "import.previewed": "Import Previewed",
  "import.confirmed": "Import Confirmed",
  "import.failed": "Import Failed",
  "import.rejected_rows_exported": "Rejected Rows Exported",
  "schema_profile.updated": "Schema Profile Updated",
  "records.exported": "Records Exported",
  "member.invited": "Member Invited",
  "member.joined": "Member Joined",
  "member.removed": "Member Removed",
  "member.role_changed": "Member Role Changed",
  "invitation.revoked": "Invitation Revoked",
};

export function getAuditActionLabel(action: string): string {
  return actionLabels[action] ?? action;
}
