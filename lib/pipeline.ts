import type { RowIssue } from "./cleaner";
import type { ValidationIssue } from "./validators";
import { mapFieldVariants } from "./normalizer";
import { cleanRow } from "./cleaner";
import { validateRow } from "./validators";
import { computeDedupeKey } from "./dedupe";
import type { SchemaProfileConfig } from "./schema-profile";

export type ProcessedRow = {
  rowIndex: number;
  status: "valid" | "auto_fixed" | "needs_review" | "rejected" | "duplicate" | "ai_repaired";
  original: Record<string, unknown>;
  cleaned: Record<string, unknown>;
  issues: RowIssue[];
  validationErrors: ValidationIssue[];
  dedupeKey: string;
};

export type ImportSummary = {
  total: number;
  valid: number;
  autoFixed: number;
  needsReview: number;
  rejected: number;
  duplicate: number;
  importable: number;
};

export function processRows(
  parsedRows: Record<string, unknown>[],
  existingDedupeKeys: Set<string> | undefined,
  profile: SchemaProfileConfig
): { rows: ProcessedRow[]; summary: ImportSummary } {
  const dedupeSet = new Set<string>(existingDedupeKeys ?? []);
  const processed: ProcessedRow[] = [];
  const summary: ImportSummary = {
    total: parsedRows.length,
    valid: 0,
    autoFixed: 0,
    needsReview: 0,
    rejected: 0,
    duplicate: 0,
    importable: 0,
  };

  for (let i = 0; i < parsedRows.length; i++) {
    const rowIndex = i + 1;
    const rawData = parsedRows[i];
    const mapped = mapFieldVariants(rawData, profile.fieldMappings);
    const { original, cleaned, issues } = cleanRow(mapped, profile.cleanupRules);
    const validation = validateRow(rowIndex, mapped, cleaned, profile);

    let status: ProcessedRow["status"] = "needs_review";

    if (validation.status === "invalid") {
      status = "rejected";
    } else if (issues.length > 0) {
      const hasWarning = issues.some((issue) => issue.severity === "warning");
      status = hasWarning ? "needs_review" : "auto_fixed";
    } else {
      status = "valid";
    }

    const dedupeKey = computeDedupeKey(cleaned, `row-${rowIndex}`, profile.dedupeStrategy.fields);
    if (status === "valid" || status === "auto_fixed") {
      if (profile.dedupeStrategy.enabled && dedupeSet.has(dedupeKey)) {
        status = "duplicate";
      } else {
        dedupeSet.add(dedupeKey);
      }
    }

    if (status === "valid") summary.valid++;
    if (status === "auto_fixed") summary.autoFixed++;
    if (status === "needs_review") summary.needsReview++;
    if (status === "rejected") summary.rejected++;
    if (status === "duplicate") summary.duplicate++;

    processed.push({
      rowIndex,
      status,
      original,
      cleaned,
      issues,
      validationErrors: validation.errors,
      dedupeKey,
    });
  }

  summary.importable = summary.valid + summary.autoFixed;

  return { rows: processed, summary };
}
