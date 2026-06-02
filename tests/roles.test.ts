import { describe, it, expect } from "vitest";
import { canManageMembers, canEditSchemaProfile, canImportData } from "../lib/auth";

describe("Role Capabilities", () => {
  it("canManageMembers", () => {
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageMembers("member")).toBe(false);
  });

  it("canEditSchemaProfile", () => {
    expect(canEditSchemaProfile("owner")).toBe(true);
    expect(canEditSchemaProfile("admin")).toBe(true);
    expect(canEditSchemaProfile("member")).toBe(false);
  });

  it("canImportData", () => {
    expect(canImportData("owner")).toBe(true);
    expect(canImportData("admin")).toBe(true);
    expect(canImportData("member")).toBe(true);
    expect(canImportData("viewer")).toBe(false); // Hypothetical
  });
});
