import { describe, it, expect } from "vitest";
import { computeDedupeKey } from "../lib/dedupe";

describe("Dedupe", () => {
  it("computes dedupe key using the first matched strategy field", () => {
    const row = { email: "test@example.com", externalId: "EXT123", name: "Alice" };
    
    // priority: email -> externalId -> name
    expect(computeDedupeKey(row, "fallback-1", ["email", "externalId"])).toBe("email:test@example.com");
    expect(computeDedupeKey(row, "fallback-1", ["externalId", "email"])).toBe("external:EXT123");
    expect(computeDedupeKey(row, "fallback-1", ["name", "email"])).toBe("name:alice");
  });

  it("falls back if no fields match", () => {
    const row = { status: "active" };
    expect(computeDedupeKey(row, "fallback-1", ["email", "externalId"])).toBe("row:fallback-1");
  });

  it("handles composite fields like name+company", () => {
    const row = { name: "Alice", company: "Acme Corp" };
    expect(computeDedupeKey(row, "fallback-1", ["name+company"])).toBe("name:alice|company:acme corp");
  });
});
