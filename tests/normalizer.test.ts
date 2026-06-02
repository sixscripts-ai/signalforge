import { describe, it, expect } from "vitest";
import { normalizeKey, mapFieldVariants } from "../lib/normalizer";
import { DEFAULT_SCHEMA_PROFILE } from "../lib/schema-profile";

describe("Normalizer", () => {
  describe("normalizeKey", () => {
    it("lowercases and replaces spaces/hyphens with underscores", () => {
      expect(normalizeKey("e-mail")).toBe("e_mail");
      expect(normalizeKey("Email Address")).toBe("email_address");
      expect(normalizeKey("Customer Name")).toBe("customer_name");
      expect(normalizeKey("   Company  Name ")).toBe("company_name");
      expect(normalizeKey("EXteRnal-ID")).toBe("external_id");
    });
  });

  describe("mapFieldVariants", () => {
    it("maps fields correctly using custom mappings", () => {
      const rawRow = {
        "e-mail": "test@example.com",
        "customer_name": "Alice",
        "random_header": "123",
      };

      const mapped = mapFieldVariants(rawRow, DEFAULT_SCHEMA_PROFILE.fieldMappings);

      expect(mapped).toHaveProperty("email", "test@example.com");
      expect(mapped).toHaveProperty("name", "Alice");
      // Unmapped fields are preserved with their normalized key
      expect(mapped).toHaveProperty("random_header", "123");
    });

    it("handles variations in capitalization and spacing", () => {
      const rawRow = {
        "E-Mail": "bob@example.com",
        " Customer  Name ": "Bob",
      };

      const mapped = mapFieldVariants(rawRow, DEFAULT_SCHEMA_PROFILE.fieldMappings);

      expect(mapped).toHaveProperty("email", "bob@example.com");
      expect(mapped).toHaveProperty("name", "Bob");
    });
  });
});
