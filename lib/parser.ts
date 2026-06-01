import Papa from "papaparse";

export type ParsedImportResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  sourceType: "csv" | "json";
  warnings?: string[];
};

type ParseInput = {
  filename: string;
  content: string;
  mimeType?: string;
  maxRows?: number;
};

export function parseImportFile(input: ParseInput): ParsedImportResult {
  const warnings: string[] = [];
  const sourceType = detectSourceType(input.filename, input.mimeType);
  const maxRows = input.maxRows ?? 1000;

  if (sourceType === "csv") {
    const result = Papa.parse<Record<string, unknown>>(input.content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (result.errors.length > 0) {
      const first = result.errors[0];
      throw new Error(`CSV parse error: ${first.message}`);
    }

    const columns = (result.meta.fields ?? []).filter(Boolean);
    if (columns.length === 0) {
      throw new Error("CSV file is missing a header row.");
    }

    let rows = result.data.map((row) => normalizeRowShape(row));
    if (rows.length === 0) {
      throw new Error("CSV file has no data rows.");
    }

    if (rows.length > maxRows) {
      rows = rows.slice(0, maxRows);
      warnings.push(`Row limit reached. Showing first ${maxRows} rows.`);
    }

    return { columns, rows, sourceType, warnings };
  }

  const parsedJson = parseJson(input.content);
  if (!Array.isArray(parsedJson)) {
    throw new Error("JSON file must be an array of objects.");
  }

  const rows = parsedJson.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("JSON array must contain objects only.");
    }
    return normalizeRowShape(row as Record<string, unknown>);
  });

  if (rows.length === 0) {
    throw new Error("JSON file has no rows.");
  }

  const columns = collectColumns(rows);
  if (rows.length > maxRows) {
    warnings.push(`Row limit reached. Showing first ${maxRows} rows.`);
  }

  return {
    columns,
    rows: rows.slice(0, maxRows),
    sourceType,
    warnings,
  };
}

function detectSourceType(filename: string, mimeType?: string): "csv" | "json" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".json")) return "json";

  if (mimeType?.includes("csv")) return "csv";
  if (mimeType?.includes("json")) return "json";

  throw new Error("Unsupported file type. Only CSV and JSON are allowed.");
}

function parseJson(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Malformed JSON file.");
  }
}

function collectColumns(rows: Record<string, unknown>[]) {
  const columns = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => columns.add(key));
  });
  return Array.from(columns);
}

function normalizeRowShape(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  Object.entries(row).forEach(([key, value]) => {
    if (!key) return;
    normalized[key.trim()] = value;
  });
  return normalized;
}
