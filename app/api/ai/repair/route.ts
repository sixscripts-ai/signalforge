/**
 * POST /api/ai/repair
 *
 * Accepts a single "needs_review" row and returns AI-powered repair suggestions.
 * The profileSnapshot is the resolved SchemaProfileConfig used during preview.
 */

import { requireWorkspace } from "@/lib/auth";
import { suggestRowRepair, isAiConfigured } from "@/lib/ai/repair";
import type { ProcessedRow } from "@/lib/pipeline";
import { SchemaProfileConfigSchema, type SchemaProfileConfig } from "@/lib/schema-profile";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Check if AI is configured before anything else
  if (!isAiConfigured()) {
    return Response.json(
      {
        error: {
          code: "AI_NOT_CONFIGURED",
          message:
            "AI repair is not available. Set AI_API_KEY in your environment to enable it.",
        },
      },
      { status: 503 }
    );
  }

  try {
    await requireWorkspace();
  } catch {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 }
    );
  }

  let body: {
    row?: ProcessedRow;
    profileSnapshot?: SchemaProfileConfig;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  const { row, profileSnapshot } = body;

  if (!row) {
    return Response.json(
      { error: { code: "MISSING_FIELDS", message: "Row data is required." } },
      { status: 400 }
    );
  }

  if (row.status !== "needs_review") {
    return Response.json(
      {
        error: {
          code: "INVALID_STATUS",
          message: `Row status is "${row.status}", expected "needs_review".`,
        },
      },
      { status: 400 }
    );
  }

  // Use provided profile snapshot, or fall back to a minimal default
  let profile: SchemaProfileConfig;
  if (profileSnapshot) {
    const parsed = SchemaProfileConfigSchema.safeParse(profileSnapshot);
    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: "INVALID_PROFILE",
            message: "Invalid schema profile configuration.",
          },
        },
        { status: 400 }
      );
    }
    profile = parsed.data;
  } else {
    const { DEFAULT_SCHEMA_PROFILE } = await import("@/lib/schema-profile");
    profile = DEFAULT_SCHEMA_PROFILE;
  }

  try {
    const result = await suggestRowRepair(row, profile);

    if (!result || result.suggestions.length === 0) {
      return Response.json({
        rowIndex: row.rowIndex,
        suggestions: [],
        message: "No suggestions could be generated for this row.",
      });
    }

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI repair request failed.";
    console.error("AI repair error:", message);

    return Response.json(
      {
        error: {
          code: "AI_REPAIR_FAILED",
          message: "AI repair failed. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
