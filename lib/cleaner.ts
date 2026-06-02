import type { SchemaProfileConfig } from "./schema-profile";

export type RowIssue = {
  field: string;
  severity: "fixed" | "warning" | "error";
  message: string;
  originalValue?: unknown;
  cleanedValue?: unknown;
};

export type CleanedRowResult = {
  original: Record<string, unknown>;
  cleaned: Record<string, unknown>;
  issues: RowIssue[];
  status: "valid" | "auto_fixed" | "needs_review" | "duplicate" | "rejected";
};

export function cleanRow(
  normalizedRow: Record<string, unknown>,
  rules: SchemaProfileConfig["cleanupRules"]
): CleanedRowResult {
  const original = { ...normalizedRow };
  const cleaned: Record<string, unknown> = { ...normalizedRow };
  const issues: RowIssue[] = [];

  // Trim whitespace globally if enabled
  if (rules.trimWhitespace) {
    Object.keys(cleaned).forEach((key) => {
      const value = cleaned[key];
      if (typeof value === "string") {
        cleaned[key] = value.trim();
      }
    });
  }

  // Collapse spaces globally if enabled
  if (rules.collapseSpaces) {
    Object.keys(cleaned).forEach((key) => {
      const value = cleaned[key];
      if (typeof value === "string") {
        cleaned[key] = value.replace(/\s+/g, " ");
      }
    });
  }

  // Email
  if (typeof cleaned.email === "string") {
    let email = cleaned.email as string;
    
    if (email.startsWith('"') && email.endsWith('"')) {
      email = email.slice(1, -1).trim();
    }
    if (email.startsWith("'") && email.endsWith("'")) {
      email = email.slice(1, -1).trim();
    }
    if (rules.lowercaseEmails) {
      email = email.toLowerCase();
    }

    if (email !== original.email) {
      issues.push({
        field: "email",
        severity: "fixed",
        message: "Cleaned and formatted email",
        originalValue: original.email,
        cleanedValue: email,
      });
      cleaned.email = email;
    }
  }

  // Name, Company, Category, External ID issues logging if changed by global trims
  ["name", "company", "category", "externalId"].forEach((field) => {
    if (cleaned[field] !== original[field]) {
      issues.push({
        field,
        severity: "fixed",
        message: "Trimmed whitespace and/or collapsed spaces",
        originalValue: original[field],
        cleanedValue: cleaned[field],
      });
    }
  });

  // Amount
  if (cleaned.amount !== undefined && cleaned.amount !== null && cleaned.amount !== "") {
    if (typeof cleaned.amount === "string" && rules.coerceAmounts) {
      const cleanedAmountStr = cleaned.amount.replace(/[^0-9.-]/g, "");
      const parsedAmount = Number.parseFloat(cleanedAmountStr);

      if (Number.isFinite(parsedAmount)) {
        issues.push({
          field: "amount",
          severity: "fixed",
          message: "Converted currency string to number",
          originalValue: original.amount,
          cleanedValue: parsedAmount,
        });
        cleaned.amount = parsedAmount;
      } else {
        issues.push({
          field: "amount",
          severity: "warning",
          message: "Amount could not be safely converted to a number",
          originalValue: original.amount,
          cleanedValue: cleaned.amount,
        });
      }
    }
  } else {
    // Treat empty as null/undefined. If it was empty string, remove it.
    if (cleaned.amount === "") {
      cleaned.amount = undefined;
    }
  }

  // Status
  if (typeof cleaned.status === "string" && rules.normalizeStatus) {
    const rawStatus = (cleaned.status as string).toLowerCase();
    let mappedStatus = rawStatus;

    if (["active", "enabled", "yes", "true"].includes(rawStatus)) {
      mappedStatus = "active";
    } else if (["inactive", "disabled", "no", "false"].includes(rawStatus)) {
      mappedStatus = "inactive";
    }

    if (mappedStatus !== original.status) {
      issues.push({
        field: "status",
        severity: "fixed",
        message: "Normalized status casing and mapped common variants",
        originalValue: original.status,
        cleanedValue: mappedStatus,
      });
      cleaned.status = mappedStatus;
    }
  }

  return {
    original,
    cleaned,
    issues,
    status: "needs_review", // Placeholder, will be overwritten by validator step
  };
}
