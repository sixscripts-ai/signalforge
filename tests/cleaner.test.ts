import { describe, it, expect } from "vitest";
import { cleanRow } from "../lib/cleaner";
import { DEFAULT_SCHEMA_PROFILE } from "../lib/schema-profile";

describe("Cleaner", () => {
  it("trims whitespace when trimWhitespace is enabled", () => {
    const raw = { name: "  Alice  ", company: " Acme Corp " };
    const result = cleanRow(raw, { ...DEFAULT_SCHEMA_PROFILE.cleanupRules, trimWhitespace: true });
    
    expect(result.cleaned.name).toBe("Alice");
    expect(result.cleaned.company).toBe("Acme Corp");
    expect(result.issues.some(i => i.field === "name" && i.severity === "fixed")).toBe(true);
  });

  it("does not trim whitespace when disabled", () => {
    const raw = { name: "  Alice  " };
    const result = cleanRow(raw, { ...DEFAULT_SCHEMA_PROFILE.cleanupRules, trimWhitespace: false, collapseSpaces: false });
    
    expect(result.cleaned.name).toBe("  Alice  ");
  });

  it("lowercases emails and strips quotes", () => {
    const raw = { email: '" BOB@EXAMPLE.COM "' };
    const result = cleanRow(raw, { ...DEFAULT_SCHEMA_PROFILE.cleanupRules, lowercaseEmails: true });
    
    expect(result.cleaned.email).toBe("bob@example.com");
  });

  it("coerces amounts to numbers", () => {
    const raw = { amount: "$1,200.50" };
    const result = cleanRow(raw, { ...DEFAULT_SCHEMA_PROFILE.cleanupRules, coerceAmounts: true });
    
    expect(result.cleaned.amount).toBe(1200.50);
  });

  it("does not coerce amounts when disabled", () => {
    const raw = { amount: "$1,200.50" };
    const result = cleanRow(raw, { ...DEFAULT_SCHEMA_PROFILE.cleanupRules, coerceAmounts: false });
    
    expect(result.cleaned.amount).toBe("$1,200.50");
  });

  it("adds a warning issue if amount coercion fails", () => {
    const raw = { amount: "N/A" };
    const result = cleanRow(raw, { ...DEFAULT_SCHEMA_PROFILE.cleanupRules, coerceAmounts: true });
    
    expect(result.cleaned.amount).toBe("N/A");
    expect(result.issues.some(i => i.field === "amount" && i.severity === "warning")).toBe(true);
  });

  it("normalizes status casing and maps variants", () => {
    const rules = { ...DEFAULT_SCHEMA_PROFILE.cleanupRules, normalizeStatus: true };
    expect(cleanRow({ status: "TRUE" }, rules).cleaned.status).toBe("active");
    expect(cleanRow({ status: "yes" }, rules).cleaned.status).toBe("active");
    expect(cleanRow({ status: "Inactive" }, rules).cleaned.status).toBe("inactive");
    expect(cleanRow({ status: "FALSE" }, rules).cleaned.status).toBe("inactive");
  });

  it("collapses spaces when enabled", () => {
    const raw = { name: "Alice   Smith" };
    const result = cleanRow(raw, { ...DEFAULT_SCHEMA_PROFILE.cleanupRules, collapseSpaces: true });
    expect(result.cleaned.name).toBe("Alice Smith");
  });
});
