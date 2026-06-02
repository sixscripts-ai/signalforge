import * as XLSX from "xlsx";
import type { NormalizedRecord } from "./db/schema";
import type { ImportRow } from "./db/schema";

export type ExportFormat = "csv" | "json" | "xlsx";
export type ExportScope = "records" | "import-rows" | "import-records";
export type ExportFilters = {
  importJobId?: string;
  workspaceId: string;
};

type ExportableRow = Record<string, unknown>;

/** Generate a filename with a timestamp */
export function makeExportFilename(
  base: string,
  format: ExportFormat
): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${base}-${ts}.${format}`;
}

/** Convert rows to the requested format and return a Blob */
export function formatExport(
  rows: ExportableRow[],
  format: ExportFormat
): Blob {
  switch (format) {
    case "csv":
      return formatCsv(rows);
    case "json":
      return formatJson(rows);
    case "xlsx":
      return formatXlsx(rows);
  }
}

/** Convert import rows (the audit trail) into exportable rows */
export function importRowsToExportable(
  rows: (ImportRow & {
    originalData: unknown;
    cleanedData: unknown;
    issues: unknown;
  })[]
): ExportableRow[] {
  return rows.map((r) => ({
    rowIndex: r.rowIndex,
    status: r.status,
    originalData: JSON.stringify(r.originalData),
    cleanedData: JSON.stringify(r.cleanedData),
    issues: JSON.stringify(r.issues),
    createdAt: r.createdAt?.toISOString() ?? "",
  }));
}

/** Convert normalized records into exportable rows */
export function recordsToExportable(
  records: NormalizedRecord[]
): ExportableRow[] {
  return records.map((r) => ({
    externalId: r.externalId ?? "",
    name: r.name ?? "",
    email: r.email ?? "",
    company: r.company ?? "",
    category: r.category ?? "",
    amount: r.amount ?? "",
    status: r.status ?? "",
    sourceRowIndex: r.sourceRowIndex,
    importJobId: r.importJobId,
    createdAt: r.createdAt?.toISOString() ?? "",
  }));
}

// --- Private Format Helpers ---

function formatCsv(rows: ExportableRow[]): Blob {
  if (!rows.length) {
    return new Blob([""], { type: "text/csv;charset=utf-8" });
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const vals = headers.map((h) => {
      const v = row[h];
      if (v == null) return "";
      const s = String(v);
      // Escape quotes and wrap in quotes if needed
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    });
    lines.push(vals.join(","));
  }
  const bom = "\uFEFF"; // BOM for Excel compatibility
  return new Blob([bom + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
}

function formatJson(rows: ExportableRow[]): Blob {
  const json = JSON.stringify(rows, null, 2);
  return new Blob([json], { type: "application/json;charset=utf-8" });
}

function formatXlsx(rows: ExportableRow[]): Blob {
  if (!rows.length) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["No data"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Export");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }
  const headers = Object.keys(rows[0]);
  const data = rows.map((row) => headers.map((h) => row[h] ?? ""));
  const aoa = [headers, ...data];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
