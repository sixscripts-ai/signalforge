import { describe, it, expect } from "vitest";
import { validateRow } from "../lib/validators";
import { DEFAULT_SCHEMA_PROFILE } from "../lib/schema-profile";

describe("Validators", () => {
  it("flags missing required fields", () => {
    const normalized = { name: "", email: null };
    const profile = { ...DEFAULT_SCHEMA_PROFILE, requiredFields: ["email"] };
    const result = validateRow(1, normalized, normalized as import("../lib/normalizer").NormalizedRow, profile);

    expect(result.status).toBe("invalid");
    expect(result.errors.some(e => e.field === "email" && e.message.includes("required"))).toBe(true);
  });

  it("flags invalid email formats", () => {
    const normalized = { email: "not-an-email", name: "Alice", externalId: "123" };
    const result = validateRow(1, normalized, normalized as import("../lib/normalizer").NormalizedRow, DEFAULT_SCHEMA_PROFILE);

    expect(result.status).toBe("invalid");
    expect(result.errors.some(e => e.field === "email" && e.message.includes("format"))).toBe(true);
  });

  it("validates identity logic (requireNameOrExternalId)", () => {
    const normalized = { email: "test@example.com" }; // missing name and externalId
    const profile = { ...DEFAULT_SCHEMA_PROFILE, requiredFields: [] };
    const result = validateRow(1, normalized, normalized as import("../lib/normalizer").NormalizedRow, profile);

    expect(result.status).toBe("invalid");
    expect(result.errors.some(e => e.field === "name" && e.message.includes("Name or externalId"))).toBe(true);
  });

  it("passes when identity logic is satisfied", () => {
    const normalized = { email: "test@example.com", name: "Alice" };
    const profile = { ...DEFAULT_SCHEMA_PROFILE, requiredFields: [] };
    const result = validateRow(1, normalized, normalized as import("../lib/normalizer").NormalizedRow, profile);

    expect(result.status).toBe("valid");
    expect(result.errors).toHaveLength(0);
  });

  it("flags non-numeric amount", () => {
    const rawRow = { amount: "N/A" };
    const normalized = { amount: undefined, name: "Alice", externalId: "123" };
    const result = validateRow(1, rawRow, normalized as import("../lib/normalizer").NormalizedRow, DEFAULT_SCHEMA_PROFILE);

    expect(result.status).toBe("invalid");
    expect(result.errors.some(e => e.field === "amount" && e.message.includes("numeric"))).toBe(true);
  });

  it("flags amount boundaries", () => {
    const profile = { ...DEFAULT_SCHEMA_PROFILE, requiredFields: ["name"], validationRules: { ...DEFAULT_SCHEMA_PROFILE.validationRules, amount: { min: 0, max: 100 } } };
    
    expect(validateRow(1, { amount: -5 }, { amount: -5, name: "Alice" } as import("../lib/normalizer").NormalizedRow, profile).status).toBe("invalid");
    expect(validateRow(1, { amount: 150 }, { amount: 150, name: "Alice" } as import("../lib/normalizer").NormalizedRow, profile).status).toBe("invalid");
    expect(validateRow(1, { amount: 50 }, { amount: 50, name: "Alice" } as import("../lib/normalizer").NormalizedRow, profile).status).toBe("valid");
  });

  it("flags unallowed status values", () => {
    const profile = { ...DEFAULT_SCHEMA_PROFILE, requiredFields: ["name"], validationRules: { ...DEFAULT_SCHEMA_PROFILE.validationRules, status: { allowedValues: ["active", "inactive"] } } };
    
    expect(validateRow(1, { status: "pending" }, { status: "pending", name: "Alice" } as import("../lib/normalizer").NormalizedRow, profile).status).toBe("invalid");
    expect(validateRow(1, { status: "active" }, { status: "active", name: "Alice" } as import("../lib/normalizer").NormalizedRow, profile).status).toBe("valid");
  });
});
