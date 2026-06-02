/**
 * POST /api/ai/repair/batch
 *
 * Accepts multiple "needs_review" rows and returns AI repair suggestions for each.
 * Processes rows sequentially. Returns partial results if some rows fail.
 */

import { requireWorkspace } from "@/lib/auth";
import { auth } from "@clerk/nextjs/server";
import { createAuditLog } from "@/lib/audit";
import {
  suggestRowRepair,
  isAiConfigured,
  type AiRepairResult,
} from "@/lib/ai/repair";
import type { ProcessedRow } from "@/lib/pipeline";
import {
  SchemaProfileConfigSchema,
  DEFAULT_SCHEMA_PROFILE,
  type SchemaProfileConfig,
} from "@/lib/schema-profile";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  let workspace;
  try {
    workspace = await requireWorkspace();
  } catch {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 }
    );
  }

  let body: {
    rows?: ProcessedRow[];
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

  const { rows, profileSnapshot } = body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json(
      { error: { code: "MISSING_FIELDS", message: "Rows array is required." } },
      { status: 400 }
    );
  }

  let profile: SchemaProfileConfig;
  if (profileSnapshot) {
    const parsed = SchemaProfileConfigSchema.safeParse(profileSnapshot);
    if (!parsed.success) {
      return Response.json(
        { error: { code: "INVALID_PROFILE", message: "Invalid schema profile configuration." } },
        { status: 400 }
      );
    }
    profile = parsed.data;
  } else {
    profile = DEFAULT_SCHEMA_PROFILE;
  }

  const needsReview = rows.filter((r) => r.status === "needs_review");
  const results: AiRepairResult[] = [];
  const errors: { rowIndex: number; message: string }[] = [];

  for (const row of needsReview) {
    try {
      const result = await suggestRowRepair(row, profile);
      if (result && result.suggestions.length > 0) {
        results.push(result);
      } else {
        results.push({ rowIndex: row.rowIndex, suggestions: [] });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({ rowIndex: row.rowIndex, message });
    }
  }

  // Log audit action for the batch
  const { userId } = await auth().catch(() => ({ userId: null }));
  if (userId && workspace) {
    createAuditLog({
      workspaceId: workspace.id,
      actorUserId: userId,
      action: "ai.repair_applied",
      entityType: "ai",
      summary: `AI repair batch: ${results.filter((r) => r.suggestions.length > 0).length}/${needsReview.length} rows with suggestions`,
      metadata: {
        totalRequested: needsReview.length,
        totalWithSuggestions: results.filter((r) => r.suggestions.length > 0).length,
        totalErrors: errors.length,
      },
    });
  }

  return Response.json({
    results,
    errors,
    totalRequested: needsReview.length,
    totalWithSuggestions: results.filter((r) => r.suggestions.length > 0).length,
  });
}
