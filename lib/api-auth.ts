import { db } from "@/lib/db";
import { apiKey } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";

// --- Key Generation ---

const KEY_PREFIX = "sf_";
const KEY_BYTES = 32;

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = KEY_PREFIX + randomBytes(KEY_BYTES).toString("hex");
  const prefix = raw.slice(0, 10) + "..."; // e.g. sf_a1b2c3d4...
  const hash = hashKey(raw);
  return { raw, prefix, hash };
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// --- Validation ---

export type KeyValidationResult = {
  valid: boolean;
  workspaceId?: string;
  keyId?: string;
  error?: string;
};

/**
 * Extract and validate an API key from the Authorization header.
 * Header format: "Authorization: Bearer sf_xxx..."
 */
export async function validateApiKey(
  authHeader: string | null
): Promise<KeyValidationResult> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid Authorization header" };
  }

  const rawKey = authHeader.slice("Bearer ".length).trim();

  if (!rawKey.startsWith(KEY_PREFIX)) {
    return { valid: false, error: "Invalid API key format" };
  }

  const hash = hashKey(rawKey);

  const found = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.keyHash, hash))
    .limit(1);

  if (!found.length) {
    return { valid: false, error: "API key not found" };
  }

  const key = found[0];

  // Check expiration
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
    return { valid: false, error: "API key has expired" };
  }

  // Update last used timestamp
  await db
    .update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.id, key.id));

  return {
    valid: true,
    workspaceId: key.workspaceId,
    keyId: key.id,
  };
}

/**
 * Middleware-style helper: call this at the top of v1 API routes.
 * Returns the workspaceId if valid, or throws an error-compatible response.
 */
export async function requireApiKey(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization");
  const result = await validateApiKey(authHeader);

  if (!result.valid || !result.workspaceId) {
    throw new ApiKeyError(result.error ?? "Unauthorized");
  }

  return result.workspaceId;
}

export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiKeyError";
  }
}
