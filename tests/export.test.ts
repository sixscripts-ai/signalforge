import { describe, it, expect } from "vitest";
import { generateRejectedCsv } from "../lib/export-rejected";
import type { ProcessedRow } from "../lib/pipeline";

describe("Export Rejected", () => {
  it("escapes commas, quotes, and newlines in CSV fields", () => {
    const mockRejectedRows: ProcessedRow[] = [
      {
        rowIndex: 1,
        status: "rejected",
        original: {
          name: 'Alice "The Boss" Smith',
          company: "Acme, Inc.",
          email: "alice\n@example.com",
        },
        cleaned: {},
        issues: [],
        validationErrors: [{ rowIndex: 1, field: "name", message: "Error 1", severity: "error" }],
        dedupeKey: "",
      }
    ];

    const csv = generateRejectedCsv(mockRejectedRows);
    
    // Verify headers
    expect(csv).toContain("row_number,email,name,company,amount,status,errors");
    
    // Verify escaped values
    expect(csv).toContain('"Alice ""The Boss"" Smith"');
    expect(csv).toContain('"Acme, Inc."');
    expect(csv).toContain('"alice\n@example.com"');
    expect(csv).toContain("Error 1");
  });

  it("handles empty or null values gracefully", () => {
    const mockRejectedRows: ProcessedRow[] = [
      {
        rowIndex: 2,
        status: "rejected",
        original: {
          name: null,
          email: undefined,
        },
        cleaned: {},
        issues: [],
        validationErrors: [],
        dedupeKey: "",
      }
    ];

    const csv = generateRejectedCsv(mockRejectedRows);
    const lines = csv.split("\n");
    expect(lines[1]).toBe("2,,,,,,");
  });
});
