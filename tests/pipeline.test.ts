import { describe, it, expect } from "vitest";
import { processRows } from "../lib/pipeline";
import { DEFAULT_SCHEMA_PROFILE } from "../lib/schema-profile";

describe("Pipeline Integration", () => {
  it("classifies rows accurately end-to-end", () => {
    const rawRows = [
      { name: "Alice", email: "alice@example.com", amount: 100 }, // valid
      { name: "Bob", email: " BOB@EXAMPLE.COM ", amount: "$200" },  // auto_fixed
      { email: "invalid-email", amount: "N/A" },                    // rejected (missing name, invalid email)
      { name: "Alice", email: "alice@example.com", amount: 300 }, // duplicate (same email)
      { name: "Charlie", email: "charlie@example.com", amount: "N/A" }, // needs_review (amount parsing fails)
    ];

    const profile = { ...DEFAULT_SCHEMA_PROFILE, requiredFields: ["name"] };
    const { rows, summary } = processRows(rawRows, undefined, profile);

    expect(summary.total).toBe(5);
    expect(summary.valid).toBe(1);
    expect(summary.autoFixed).toBe(1);
    expect(summary.rejected).toBe(1);
    expect(summary.duplicate).toBe(1);
    expect(summary.needsReview).toBe(1);
    expect(summary.importable).toBe(2);

    expect(rows[0].status).toBe("valid");
    expect(rows[1].status).toBe("auto_fixed");
    expect(rows[2].status).toBe("rejected");
    expect(rows[3].status).toBe("duplicate");
    expect(rows[4].status).toBe("needs_review");
  });

  it("respects custom profile configurations", () => {
    const rawRows = [
      { name: "Bob", email: " BOB@EXAMPLE.COM ", amount: "$200" }
    ];

    // Disable cleanup rules that would normally fix this row
    const profile = {
      ...DEFAULT_SCHEMA_PROFILE,
      cleanupRules: {
        ...DEFAULT_SCHEMA_PROFILE.cleanupRules,
        lowercaseEmails: false,
        coerceAmounts: false,
      }
    };

    const { rows } = processRows(rawRows, undefined, profile);
    
    // The amount is not coerced, so it fails validation (must be numeric if provided)
    // The email is not lowercased, but format might still pass or fail depending on regex
    // Since amount fails validation, it should be rejected.
    expect(rows[0].status).toBe("rejected");
  });
});
