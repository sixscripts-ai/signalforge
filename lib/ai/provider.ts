/**
 * AI Provider abstraction.
 *
 * Reads `AI_API_KEY` and `AI_BASE_URL` from environment variables.
 * Falls back to OpenAI defaults if `AI_BASE_URL` is not set.
 * Returns `null` from `getAiClient()` if no API key is configured,
 * allowing callers to degrade gracefully.
 */

import OpenAI from "openai";

let client: OpenAI | null = null;

export type AiModel = "gpt-4o-mini" | "gpt-4o" | string;

export type AiClientConfig = {
  apiKey: string;
  baseURL?: string;
  model?: AiModel;
};

/** Default model — fast + cheap for structured data tasks */
const DEFAULT_MODEL: AiModel = "gpt-4o-mini";

/**
 * Get or create the singleton OpenAI client.
 * Returns `null` if the AI provider is not configured.
 */
export function getAiClient(
  overrides?: Partial<AiClientConfig>
): OpenAI | null {
  const apiKey = overrides?.apiKey ?? process.env.AI_API_KEY;
  if (!apiKey) return null;

  if (!client || overrides) {
    client = new OpenAI({
      apiKey,
      baseURL: overrides?.baseURL ?? process.env.AI_BASE_URL ?? undefined,
    });
  }

  return client;
}

/**
 * Get the configured model name.
 */
export function getAiModel(overrides?: Partial<AiClientConfig>): AiModel {
  return overrides?.model ?? process.env.AI_MODEL ?? DEFAULT_MODEL;
}

/**
 * Check whether the AI provider is configured and ready.
 */
export function isAiConfigured(): boolean {
  return !!process.env.AI_API_KEY;
}

/**
 * Reset the cached client (useful for testing or reconfiguration).
 */
export function resetAiClient(): void {
  client = null;
}
