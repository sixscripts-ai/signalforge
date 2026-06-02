/**
 * AI-powered row repair.
 *
 * Uses the configured AI provider (OpenAI-compatible) to suggest fixes
 * for rows flagged as "needs_review" during the import pipeline.
 */

import type { ProcessedRow } from "@/lib/pipeline";
import type { SchemaProfileConfig } from "@/lib/schema-profile";
import type { RowIssue } from "@/lib/cleaner";
import type { ValidationIssue } from "@/lib/validators";
import { getAiClient, getAiModel, isAiConfigured } from "./provider";

// ── Types ───────────────────────────────────────────────────────

export type SuggestionConfidence = "high" | "medium" | "low";

export type AiRepairSuggestion = {
  /** The normalized field name (e.g. "amount", "email", "status") */
  field: string;
  /** The value currently in the cleaned row */
  currentValue: unknown;
  /** The value the AI recommends */
  suggestedValue: unknown;
  /** A short human-readable explanation */
  reasoning: string;
  /** AI's confidence in this suggestion */
  confidence: SuggestionConfidence;
};

export type AiRepairResult = {
  /** Row index these suggestions apply to */
  rowIndex: number;
  /** Ordered list of suggested fixes */
  suggestions: AiRepairSuggestion[];
};

// ── JSON Schema for Structured Output ───────────────────────────

const repairResponseSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "row_repair_suggestions",
    strict: true,
    schema: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          description:
            "Suggested fixes for fields that have issues. Only include fields where you can suggest a concrete improvement.",
          items: {
            type: "object",
            properties: {
              field: {
                type: "string",
                description:
                  'The normalized field name — one of: email, name, amount, status, company, category, externalId.',
              },
              currentValue: {
                type: ["string", "number", "null"],
                description: "The current value in the row.",
              },
              suggestedValue: {
                type: ["string", "number", "null"],
                description:
                  "Your suggested replacement value. For amounts use a number. For text fields use a string. Use null to clear the field.",
              },
              reasoning: {
                type: "string",
                description:
                  "Brief explanation of why this fix is appropriate (1-2 sentences).",
              },
              confidence: {
                type: "string",
                enum: ["high", "medium", "low"],
                description:
                  "How confident you are in this suggestion. High = unambiguous fix. Medium = reasonable guess. Low = uncertain.",
              },
            },
            required: [
              "field",
              "currentValue",
              "suggestedValue",
              "reasoning",
              "confidence",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    },
  },
} satisfies OpenAIResponseFormatJSONSchema;

// ── System Prompt ───────────────────────────────────────────────

function buildSystemPrompt(profile: SchemaProfileConfig): string {
  return `You are a data cleaning assistant for an import pipeline. Your job is to suggest fixes for rows that were flagged as "needs review" during import.

## Schema Profile Context

The import is using the following schema profile configuration:

**Field Mappings** (source column → normalized field):
${Object.entries(profile.fieldMappings)
  .map(([src, norm]) => `  - "${src}" → "${norm}"`)
  .join("\n")}

**Validation Rules**:
${
  profile.validationRules?.email?.required
    ? "  - email: required, must be valid format"
    : "  - email: must be valid format if present"
}
${
  profile.validationRules?.amount?.required
    ? `  - amount: required, range [${profile.validationRules.amount.min ?? "any"}, ${profile.validationRules.amount.max ?? "any"}]`
    : "  - amount: optional"
}
${
  profile.validationRules?.status?.allowedValues?.length
    ? `  - status: allowed values = [${profile.validationRules.status.allowedValues.join(", ")}]`
    : "  - status: no restriction"
}
${
  profile.validationRules?.identity?.requireNameOrExternalId
    ? "  - identity: must have name OR externalId"
    : "  - identity: no restriction"
}

**Dedupe Strategy**:
  - Enabled: ${profile.dedupeStrategy.enabled}
  - Dedupe fields: [${profile.dedupeStrategy.fields.join(", ")}]
  - On duplicate: ${profile.dedupeStrategy.action}

## Instructions

A row has been through the standard cleaning pipeline (trimming, lowercasing, currency parsing, status normalization) but still has unresolved warnings. Review the row's original data, the issues flagged, and suggest fixes.

Rules:
1. Only suggest a fix if you are reasonably confident it improves the data.
2. For amounts, prefer numeric values. If you cannot parse the amount, suggest setting it to 0 or null.
3. For email, only suggest a fix if the value looks salvageable (e.g. missing domain, extra spaces).
4. For status, map to one of the allowed values if specified.
5. For name/company/category, suggest corrections for obvious typos or formatting issues.
6. If a field has no clear fix, do NOT include it in the suggestions.
7. Return an empty array if no suggestions can be made.`;
}

// ── User Prompt ─────────────────────────────────────────────────

function buildUserPrompt(row: ProcessedRow): string {
  const formatIssue = (i: RowIssue | ValidationIssue): string => {
    let line = `  - [${i.severity}] ${i.field}: ${i.message}`;
    if ("originalValue" in i && i.originalValue !== undefined) {
      line += ` (original: ${JSON.stringify(i.originalValue)}`;
    }
    if ("cleanedValue" in i && i.cleanedValue !== undefined) {
      line += ` → cleaned: ${JSON.stringify(i.cleanedValue)})`;
    } else {
      line += ")";
    }
    return line;
  };

  const issuesText = [...row.issues, ...row.validationErrors].map(formatIssue).join("\n");

  return `## Row #${row.rowIndex}

**Original data**:
${JSON.stringify(row.original, null, 2)}

**Cleaned data** (after standard pipeline):
${JSON.stringify(row.cleaned, null, 2)}

**Issues flagged**:
${issuesText || "  (none — review requested)"}

Suggest fixes for any fields you can improve. If no clear fix exists, return an empty suggestions array.`;
}

// ── Helper: apply a suggestion to a row ─────────────────────────

export function applySuggestion(
  row: ProcessedRow,
  suggestion: AiRepairSuggestion
): ProcessedRow {
  const cleaned = { ...row.cleaned, [suggestion.field]: suggestion.suggestedValue };

  const updatedIssue: import("@/lib/cleaner").RowIssue = {
    field: suggestion.field,
    severity: "fixed",
    message: `AI repair: ${suggestion.reasoning}`,
    originalValue: suggestion.currentValue,
    cleanedValue: suggestion.suggestedValue,
  };

  return {
    ...row,
    status: "ai_repaired",
    cleaned,
    issues: [
      ...row.issues.filter((i) => i.field !== suggestion.field),
      updatedIssue,
    ],
  };
}

// ── Internal Type ───────────────────────────────────────────────

type OpenAIResponseFormatJSONSchema = {
  type: "json_schema";
  json_schema: {
    name: string;
    strict?: boolean;
    schema: Record<string, unknown>;
  };
};

// ── Main ────────────────────────────────────────────────────────

export type RepairOptions = {
  /** Max retries if the AI returns invalid JSON (default: 1) */
  maxRetries?: number;
};

/**
 * Suggest AI-powered repairs for a single "needs_review" row.
 *
 * Returns structured suggestions or null if the AI provider is not configured
 * or the row doesn't need review.
 */
export async function suggestRowRepair(
  row: ProcessedRow,
  profile: SchemaProfileConfig,
  options?: RepairOptions
): Promise<AiRepairResult | null> {
  // Only suggest for rows that need review
  if (row.status !== "needs_review") return null;

  const client = getAiClient();
  if (!client) return null;

  const model = getAiModel();
  const maxRetries = options?.maxRetries ?? 1;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        response_format: repairResponseSchema,
        messages: [
          { role: "system", content: buildSystemPrompt(profile) },
          { role: "user", content: buildUserPrompt(row) },
        ],
        temperature: 0.1, // low temperature for deterministic output
        max_tokens: 2000,
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("AI returned empty response");
      }

      const parsed = JSON.parse(content) as {
        suggestions: AiRepairSuggestion[];
      };

      if (!Array.isArray(parsed.suggestions)) {
        throw new Error("AI response missing suggestions array");
      }

      return {
        rowIndex: row.rowIndex,
        suggestions: parsed.suggestions,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        // Wait briefly before retry
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  throw lastError ?? new Error("AI repair failed after retries");
}

/**
 * Suggest repairs for multiple rows at once.
 *
 * Processes rows sequentially to avoid overwhelming the AI provider.
 * Returns a map of rowIndex → repair result (or null if no suggestions).
 */
export async function suggestBatchRepair(
  rows: ProcessedRow[],
  profile: SchemaProfileConfig,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<number, AiRepairResult>> {
  const needsReview = rows.filter((r) => r.status === "needs_review");
  const results = new Map<number, AiRepairResult>();

  for (let i = 0; i < needsReview.length; i++) {
    const row = needsReview[i];
    try {
      const result = await suggestRowRepair(row, profile);
      if (result && result.suggestions.length > 0) {
        results.set(row.rowIndex, result);
      }
    } catch {
      // Silently skip rows that fail — the UI will show which rows weren't repaired
    }
    onProgress?.(i + 1, needsReview.length);
  }

  return results;
}

export { isAiConfigured };
