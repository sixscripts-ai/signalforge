import { describe, it, expect } from "vitest";
import { getAuditActionLabel } from "../lib/audit-labels";

describe("Audit Log Utilities", () => {
  describe("getAuditActionLabel", () => {
    it("returns label for workspace.created", () => {
      expect(getAuditActionLabel("workspace.created")).toBe("Workspace Created");
    });

    it("returns label for workspace.updated", () => {
      expect(getAuditActionLabel("workspace.updated")).toBe("Workspace Updated");
    });

    it("returns label for import.previewed", () => {
      expect(getAuditActionLabel("import.previewed")).toBe("Import Previewed");
    });

    it("returns label for import.confirmed", () => {
      expect(getAuditActionLabel("import.confirmed")).toBe("Import Confirmed");
    });

    it("returns label for import.failed", () => {
      expect(getAuditActionLabel("import.failed")).toBe("Import Failed");
    });

    it("returns label for import.rejected_rows_exported", () => {
      expect(getAuditActionLabel("import.rejected_rows_exported")).toBe("Rejected Rows Exported");
    });

    it("returns label for schema_profile.updated", () => {
      expect(getAuditActionLabel("schema_profile.updated")).toBe("Schema Profile Updated");
    });

    it("returns label for records.exported", () => {
      expect(getAuditActionLabel("records.exported")).toBe("Records Exported");
    });

    it("returns label for member.invited", () => {
      expect(getAuditActionLabel("member.invited")).toBe("Member Invited");
    });

    it("returns label for member.joined", () => {
      expect(getAuditActionLabel("member.joined")).toBe("Member Joined");
    });

    it("returns label for member.removed", () => {
      expect(getAuditActionLabel("member.removed")).toBe("Member Removed");
    });

    it("returns label for member.role_changed", () => {
      expect(getAuditActionLabel("member.role_changed")).toBe("Member Role Changed");
    });

    it("returns label for invitation.revoked", () => {
      expect(getAuditActionLabel("invitation.revoked")).toBe("Invitation Revoked");
    });

    it("returns the raw action string for unknown actions", () => {
      expect(getAuditActionLabel("unknown.action")).toBe("unknown.action");
    });
  });
});
