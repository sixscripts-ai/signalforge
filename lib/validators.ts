import { z } from "zod";
import type { NormalizedRow } from "./normalizer";
import type { SchemaProfileConfig } from "./schema-profile";

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

export function validateRow(
  rowIndex: number,
  rawRow: Record<string, unknown>,
  normalized: NormalizedRow,
  profile: SchemaProfileConfig
): ValidationResult {
  const errors: ValidationIssue[] = [];

  // Required Fields Validation
  for (const field of profile.requiredFields) {
    if (
      normalized[field as keyof NormalizedRow] === undefined ||
      normalized[field as keyof NormalizedRow] === null ||
      normalized[field as keyof NormalizedRow] === ""
    ) {
      errors.push({
        rowIndex,
        field,
        message: `${field} is required.`,
        severity: "error",
      });
    }
  }

  // Email format validation
  if (normalized.email && profile.validationRules?.email?.format === "email") {
    const emailSchema = z.string().email();
    const result = emailSchema.safeParse(normalized.email);
    if (!result.success) {
      errors.push({
        rowIndex,
        field: "email",
        message: "Invalid email format",
        severity: "error",
      });
    }
  }

  // Identity logic (Legacy / Custom)
  if (profile.validationRules?.identity?.requireNameOrExternalId) {
    if (!normalized.name && !normalized.externalId) {
      errors.push({
        rowIndex,
        field: "name",
        message: "Name or externalId is required.",
        severity: "error",
      });
    }
  }

  // Amount format check
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

  // Amount Min/Max check
  if (normalized.amount !== undefined) {
    const min = profile.validationRules?.amount?.min;
    const max = profile.validationRules?.amount?.max;
    if (min !== undefined && normalized.amount < min) {
      errors.push({ rowIndex, field: "amount", message: `Amount must be at least ${min}`, severity: "error" });
    }
    if (max !== undefined && normalized.amount > max) {
      errors.push({ rowIndex, field: "amount", message: `Amount must be at most ${max}`, severity: "error" });
    }
  }

  // Status allowed values check
  if (normalized.status !== undefined && profile.validationRules?.status?.allowedValues) {
    if (!profile.validationRules.status.allowedValues.includes(normalized.status)) {
      errors.push({
        rowIndex,
        field: "status",
        message: `Status must be one of: ${profile.validationRules.status.allowedValues.join(", ")}`,
        severity: "error"
      });
    }
  }

  return {
    status: errors.length > 0 ? "invalid" : "valid",
    errors,
  };
}
