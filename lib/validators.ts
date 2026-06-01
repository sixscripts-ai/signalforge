import { z } from "zod";
import type { NormalizedRow } from "./normalizer";

export type ValidationIssue = {
  rowIndex: number;
  field: string;
  message: string;
  severity: "warning" | "error";
};

export type ValidationResult = {
  status: "valid" | "invalid";
  errors: ValidationIssue[];
};

const baseSchema = z.object({
  externalId: z.string().trim().optional(),
  name: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  company: z.string().trim().optional(),
  category: z.string().trim().optional(),
  amount: z.number().optional(),
  status: z.string().trim().optional(),
});

export function validateRow(
  rowIndex: number,
  rawRow: Record<string, unknown>,
  normalized: NormalizedRow
): ValidationResult {
  const errors: ValidationIssue[] = [];

  const parsed = baseSchema.safeParse(normalized);
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => {
      errors.push({
        rowIndex,
        field: issue.path[0]?.toString() ?? "row",
        message: issue.message,
        severity: "error",
      });
    });
  }

  if (!normalized.name && !normalized.externalId) {
    errors.push({
      rowIndex,
      field: "name",
      message: "Name or externalId is required.",
      severity: "error",
    });
  }

  const rawAmount = rawRow.amount;
  if (
    rawAmount !== undefined &&
    rawAmount !== null &&
    rawAmount !== "" &&
    normalized.amount === undefined
  ) {
    errors.push({
      rowIndex,
      field: "amount",
      message: "Amount must be numeric when provided.",
      severity: "error",
    });
  }

  return {
    status: errors.length > 0 ? "invalid" : "valid",
    errors,
  };
}
