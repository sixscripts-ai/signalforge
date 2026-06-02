import { db } from "@/lib/db";
import { webhook } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";

// --- Types ---

export type WebhookEvent =
  | "import.completed"
  | "import.failed"
  | "import.started";

export type WebhookPayload = {
  event: WebhookEvent;
  timestamp: string;
  workspaceId: string;
  data: Record<string, unknown>;
};

// --- Webhook CRUD ---

export async function getWorkspaceWebhooks(workspaceId: string) {
  return db
    .select()
    .from(webhook)
    .where(
      and(eq(webhook.workspaceId, workspaceId), eq(webhook.active, "true"))
    )
    .orderBy(webhook.createdAt);
}

export async function getAllWorkspaceWebhooks(workspaceId: string) {
  return db
    .select()
    .from(webhook)
    .where(eq(webhook.workspaceId, workspaceId))
    .orderBy(webhook.createdAt);
}

// --- Signing ---

export function signPayload(
  payload: WebhookPayload,
  secret: string
): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(JSON.stringify(payload));
  return `sha256=${hmac.digest("hex")}`;
}

export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  const expectedPrefixed = `sha256=${expected}`;
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedPrefixed)
    );
  } catch {
    return false;
  }
}

// --- Delivery ---

export type DeliveryResult = {
  success: boolean;
  statusCode?: number;
  error?: string;
};

export async function deliverWebhook(
  hook: typeof webhook.$inferSelect,
  payload: WebhookPayload
): Promise<DeliveryResult> {
  const signature = signPayload(payload, hook.signingSecret);
  const body = JSON.stringify(payload);

  try {
    const response = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SignalForge-Signature": signature,
        "X-SignalForge-Event": payload.event,
        "User-Agent": "SignalForge-Webhook/1.0",
      },
      body,
      // 10 second timeout
      signal: AbortSignal.timeout(10_000),
    });

    const success = response.ok;

    await db
      .update(webhook)
      .set({
        lastSentAt: new Date(),
        lastStatus: success ? "success" : "failed",
        lastError: success ? null : `HTTP ${response.status}`,
      })
      .where(eq(webhook.id, hook.id));

    return {
      success,
      statusCode: response.status,
      error: success ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await db
      .update(webhook)
      .set({
        lastSentAt: new Date(),
        lastStatus: "failed",
        lastError: message,
      })
      .where(eq(webhook.id, hook.id));

    return { success: false, error: message };
  }
}

/** Deliver an event to all active webhooks in a workspace */
export async function broadcastEvent(
  workspaceId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<DeliveryResult[]> {
  const hooks = await getWorkspaceWebhooks(workspaceId);
  const subscribed = hooks.filter((h) => {
    const events = h.events as string[];
    return events.includes(event) || events.includes("*");
  });

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    workspaceId,
    data,
  };

  const results = await Promise.allSettled(
    subscribed.map((hook) => deliverWebhook(hook, payload))
  );

  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { success: false, error: r.reason?.message ?? "Delivery failed" }
  );
}
