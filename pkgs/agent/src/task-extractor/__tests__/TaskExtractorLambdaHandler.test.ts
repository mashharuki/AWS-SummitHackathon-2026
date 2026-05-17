import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TaskExtractorLambdaHandler unit tests
 *
 * Strategy: Mock the module-level singletons (BedrockClientAdapter, DynamoTaskCandidateRepository)
 * by mocking the imported modules with vi.mock().
 *
 * No real Bedrock or DynamoDB calls are made.
 */

// ─────────────────────────────────────────────
// Module mocks (hoisted)
// ─────────────────────────────────────────────

const mockConverse = vi.fn();
const mockCreate = vi.fn();

vi.mock("../../bedrock/BedrockClientAdapter.js", () => ({
  BedrockClientAdapter: vi.fn(() => ({
    converse: mockConverse,
  })),
}));

vi.mock("../../repositories/DynamoTaskCandidateRepository.js", () => ({
  DynamoTaskCandidateRepository: vi.fn(() => ({
    create: mockCreate,
    findAllByUserId: vi.fn(),
    findById: vi.fn(),
    approve: vi.fn(),
    delete: vi.fn(),
  })),
  createTaskCandidateWithUserId: vi.fn(
    async (_repo: unknown, _userId: string, candidate: unknown) => ({
      ...(candidate as object),
      PK: "USER#cognito-user-abc",
      SK: "TASK_CAND#01HX000000000000000000000",
      candidateId: "01HX000000000000000000000",
    }),
  ),
}));

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeToolUseResponse(
  overrides: {
    is_task?: boolean;
    title?: string;
    deadline?: string | null;
    requester?: string;
    description?: string;
  } = {},
) {
  const input = {
    is_task: true,
    title: "資料を作成する",
    deadline: "2026-05-25",
    requester: "U99999",
    description: "月曜のMTG用資料",
    ...overrides,
  };
  return {
    $metadata: {},
    output: {
      message: {
        role: "assistant",
        content: [
          {
            toolUse: {
              toolUseId: "tool-001",
              name: "extract_task_attributes",
              input,
            },
          },
        ],
      },
    },
    stopReason: "tool_use",
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    metrics: { latencyMs: 300 },
  };
}

const validEvent = {
  source: "slack",
  userId: "cognito-user-abc",
  message: {
    text: "月曜までに資料を作っておいてください。",
    channelId: "C12345",
    messageTs: "1234567890.123456",
    teamId: "T12345",
    userId: "U99999",
  },
};

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe("TaskExtractorLambdaHandler", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env["PSEUDONYMIZE_SALT"] = "test-salt";
    process.env["BEDROCK_REGION"] = "ap-northeast-1";
  });

  it("processes a valid task event without throwing", async () => {
    mockConverse.mockResolvedValueOnce(makeToolUseResponse());

    const { handler } = await import("../TaskExtractorLambdaHandler.js");
    await expect(handler(validEvent)).resolves.toBeUndefined();
    expect(mockConverse).toHaveBeenCalledOnce();
  });

  it("returns without error for invalid EventBridge payload (no DLQ)", async () => {
    const { handler } = await import("../TaskExtractorLambdaHandler.js");

    // Malformed payload — missing required fields
    const malformed = { source: "slack", userId: "" };
    await expect(handler(malformed)).resolves.toBeUndefined();

    // Bedrock should NOT have been called
    expect(mockConverse).not.toHaveBeenCalled();
  });

  it("returns without error for completely invalid payload", async () => {
    const { handler } = await import("../TaskExtractorLambdaHandler.js");
    await expect(handler(null)).resolves.toBeUndefined();
    expect(mockConverse).not.toHaveBeenCalled();
  });

  it("skips persistence when Bedrock says not a task", async () => {
    mockConverse.mockResolvedValueOnce(
      makeToolUseResponse({
        is_task: false,
        title: "",
        requester: "",
        description: "",
        deadline: null,
      }),
    );

    const { handler } = await import("../TaskExtractorLambdaHandler.js");
    await expect(handler(validEvent)).resolves.toBeUndefined();
    // createTaskCandidateWithUserId (which calls create) should not be called
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("propagates Bedrock errors (allows Lambda retry / DLQ)", async () => {
    mockConverse.mockRejectedValueOnce(new Error("ThrottlingException"));

    const { handler } = await import("../TaskExtractorLambdaHandler.js");
    await expect(handler(validEvent)).rejects.toThrow("ThrottlingException");
  });
});
