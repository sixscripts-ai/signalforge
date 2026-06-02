import type { ProcessedRow } from "./pipeline";

export function generateRejectedCsv(rows: ProcessedRow[]): string {
  const rejected = rows.filter((r) => r.status === "rejected");
  if (rejected.length === 0) return "";

  const headers = ["row_number", "email", "name", "company", "amount", "status", "errors"];

  const csvRows = rejected.map((row) => {
    const errors = row.validationErrors
      .map((e) => e.message)
      .join("; ");

    return [
      row.rowIndex,
      escapeCsvField(String(row.original.email ?? "")),
      escapeCsvField(String(row.original.name ?? "")),
      escapeCsvField(String(row.original.company ?? "")),
      escapeCsvField(String(row.original.amount ?? "")),
      escapeCsvField(String(row.original.status ?? "")),
      escapeCsvField(errors),
    ].join(",");
  });

  return [headers.join(","), ...csvRows].join("\n");
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
