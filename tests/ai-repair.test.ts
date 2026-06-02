import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  suggestRowRepair,
  suggestBatchRepair,
  applySuggestion,
  type AiRepairSuggestion,
} from "../lib/ai/repair";
import type { ProcessedRow } from "../lib/pipeline";
import type { SchemaProfileConfig } from "../lib/schema-profile";
import { DEFAULT_SCHEMA_PROFILE } from "../lib/schema-profile";

// ── Mocks ──────────────────────────────────────────────────────────

const mockCreate = vi.fn();

vi.mock("../lib/ai/provider", () => ({
  getAiClient: vi.fn(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
  getAiModel: vi.fn(() => "gpt-4o-mini"),
  isAiConfigured: vi.fn(() => true),
  resetAiClient: vi.fn(),
}));

// ── Fixtures ────────────────────────────────────────────────────────

const baseProfile: SchemaProfileConfig = {
  ...DEFAULT_SCHEMA_PROFILE,
  fieldMappings: {
    "Full Name": "name",
    "Email Address": "email",
    Amount: "amount",
  },
  validationRules: {
    email: { required: true },
    amount: { required: true, min: 0, max: 10000 },
    status: { allowedValues: ["active", "inactive", "pending"] },
    identity: { requireNameOrExternalId: true },
  },
  dedupeStrategy: {
    enabled: true,
    fields: ["email"],
    action: "flag",
  },
};

function makeNeedsReviewRow(overrides: Partial<ProcessedRow> = {}): ProcessedRow {
  return {
    rowIndex: 0,
    status: "needs_review",
    original: { "Full Name": "John", "Email Address": "john@", Amount: "N/A" },
    cleaned: { name: "John", email: "john@", amount: null },
    issues: [
      { field: "email", severity: "warning", message: "Email looks incomplete", originalValue: "john@", cleanedValue: "john@" },
      { field: "amount", severity: "warning", message: "Amount is unparseable", originalValue: "N/A", cleanedValue: null },
    ],
    validationErrors: [],
    ...overrides,
  };
}

function makeValidRow(overrides: Partial<ProcessedRow> = {}): ProcessedRow {
  return {
    rowIndex: 1,
    status: "valid",
    original: { "Full Name": "Jane", "Email Address": "jane@example.com", Amount: "200" },
    cleaned: { name: "Jane", email: "jane@example.com", amount: 200 },
    issues: [],
    validationErrors: [],
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("suggestRowRepair", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns null when AI is not configured", async () => {
    // Re-mock getAiClient to return null for this test
    const provider = await import("../lib/ai/provider");
    vi.mocked(provider.getAiClient).mockReturnValueOnce(null);

    const result = await suggestRowRepair(makeNeedsReviewRow(), baseProfile);
    expect(result).toBeNull();
  });

  it("returns null when row status is not needs_review", async () => {
    const result = await suggestRowRepair(makeValidRow(), baseProfile);
    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns suggestions when AI responds with valid data", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              suggestions: [
                {
                  field: "email",
                  currentValue: "john@",
                  suggestedValue: "john@example.com",
                  reasoning: "Email was missing a domain. Added a plausible domain.",
                  confidence: "high",
                },
                {
                  field: "amount",
                  currentValue: null,
                  suggestedValue: 0,
                  reasoning: "Amount was unparseable. Set to 0 as default.",
                  confidence: "medium",
                },
              ],
            }),
          },
        },
      ],
    });

    const row = makeNeedsReviewRow({ rowIndex: 5 });
    const result = await suggestRowRepair(row, baseProfile);

    expect(result).not.toBeNull();
    expect(result!.rowIndex).toBe(5);
    expect(result!.suggestions).toHaveLength(2);

    expect(result!.suggestions[0]).toMatchObject({
      field: "email",
      suggestedValue: "john@example.com",
      confidence: "high",
    });

    expect(result!.suggestions[1]).toMatchObject({
      field: "amount",
      suggestedValue: 0,
      confidence: "medium",
    });
  });

  it("returns empty suggestions array when AI returns no fixes", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ suggestions: [] }) } }],
    });

    const result = await suggestRowRepair(makeNeedsReviewRow(), baseProfile);
    expect(result).not.toBeNull();
    expect(result!.suggestions).toHaveLength(0);
  });

  it("retries when AI returns empty content", async () => {
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: "" } }] })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestions: [
                  {
                    field: "email",
                    currentValue: "john@",
                    suggestedValue: "john@example.com",
                    reasoning: "Added missing domain.",
                    confidence: "high",
                  },
                ],
              }),
            },
          },
        ],
      });

    const result = await suggestRowRepair(makeNeedsReviewRow(), baseProfile);
    expect(result).not.toBeNull();
    expect(result!.suggestions).toHaveLength(1);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: "" } }] });

    await expect(suggestRowRepair(makeNeedsReviewRow(), baseProfile, { maxRetries: 1 })).rejects.toThrow();
    expect(mockCreate).toHaveBeenCalledTimes(2); // initial + 1 retry
  });
});

describe("applySuggestion", () => {
  it("updates cleaned data and sets ai_repaired status", () => {
    const row = makeNeedsReviewRow();
    const suggestion: AiRepairSuggestion = {
      field: "email",
      currentValue: "john@",
      suggestedValue: "john@example.com",
      reasoning: "Email was missing a domain.",
      confidence: "high",
    };

    const updated = applySuggestion(row, suggestion);

    expect(updated.status).toBe("ai_repaired");
    expect(updated.cleaned.email).toBe("john@example.com");
    // Other cleaned fields should remain unchanged
    expect(updated.cleaned.name).toBe("John");
    expect(updated.cleaned.amount).toBeNull();
  });

  it("replaces existing issue for the same field", () => {
    const row = makeNeedsReviewRow();
    const suggestion: AiRepairSuggestion = {
      field: "email",
      currentValue: "john@",
      suggestedValue: "john@fixed.com",
      reasoning: "Fixed email domain.",
      confidence: "high",
    };

    const updated = applySuggestion(row, suggestion);

    // Should have exactly 2 issues: the replaced email + the unchanged amount issue
    const emailIssues = updated.issues.filter((i) => i.field === "email");
    expect(emailIssues).toHaveLength(1);
    expect(emailIssues[0].message).toContain("AI repair:");
    expect(emailIssues[0].originalValue).toBe("john@");
    expect(emailIssues[0].cleanedValue).toBe("john@fixed.com");
  });
});

describe("suggestBatchRepair", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("skips non-needs_review rows", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ suggestions: [] }) } }],
    });

    const rows = [
      makeValidRow({ rowIndex: 0 }),
      makeValidRow({ rowIndex: 1 }),
      makeValidRow({ rowIndex: 2 }),
    ];

    const results = await suggestBatchRepair(rows, baseProfile);
    expect(results.size).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("processes only needs_review rows", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ suggestions: [] }) } }],
    });

    const rows = [
      makeValidRow({ rowIndex: 0 }),
      makeNeedsReviewRow({ rowIndex: 1 }),
      makeValidRow({ rowIndex: 2 }),
      makeNeedsReviewRow({ rowIndex: 3 }),
    ];

    await suggestBatchRepair(rows, baseProfile);
    expect(mockCreate).toHaveBeenCalledTimes(2); // only the 2 needs_review rows
  });

  it("calls onProgress callback", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ suggestions: [] }) } }],
    });

    const rows = [
      makeNeedsReviewRow({ rowIndex: 0 }),
      makeNeedsReviewRow({ rowIndex: 1 }),
      makeNeedsReviewRow({ rowIndex: 2 }),
    ];

    const onProgress = vi.fn();
    await suggestBatchRepair(rows, baseProfile, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3);
    expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3);
  });

  it("collects results with suggestions", async () => {
    const fixedSuggestion = JSON.stringify({
      suggestions: [
        {
          field: "email",
          currentValue: "john@",
          suggestedValue: "john@fixed.com",
          reasoning: "Fixed.",
          confidence: "high",
        },
      ],
    });
    const emptySuggestion = JSON.stringify({ suggestions: [] });

    mockCreate
      .mockResolvedValueOnce({
        choices: [{ message: { content: fixedSuggestion } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: emptySuggestion } }],
      });

    const rows = [
      makeNeedsReviewRow({ rowIndex: 0 }),
      makeNeedsReviewRow({ rowIndex: 1 }),
    ];

    const results = await suggestBatchRepair(rows, baseProfile);

    expect(results.size).toBe(1); // only row 0 has suggestions
    expect(results.has(0)).toBe(true);
    expect(results.has(1)).toBe(false);
  });
});
