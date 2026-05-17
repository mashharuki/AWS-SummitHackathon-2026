import type { Proposal } from "@saboru/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SaboriProposerLambdaHandler ユニットテスト
 *
 * 方針: vi.mock で重い依存関係（BedrockClientAdapter、DynamoProposalRepository、
 * ContextCollector、SaboriProposerAgent、PersonaRenderer）をモック化しハンドラーロジックを別離する。
 */

// ─────────────────────────────────────────────
// モジュールレベル依存関係のモック
// ─────────────────────────────────────────────

const mockPropose = vi.fn();
const mockGetSlackToken = vi.fn();

vi.mock("../SaboriProposerAgent.js", () => ({
  SaboriProposerAgent: vi.fn().mockImplementation(() => ({
    propose: mockPropose,
  })),
}));

vi.mock("../../bedrock/BedrockClientAdapter.js", () => ({
  BedrockClientAdapter: vi.fn().mockImplementation(() => ({
    converse: vi.fn(),
    converseStream: vi.fn(),
  })),
}));

vi.mock("../../repositories/DynamoProposalRepository.js", () => ({
  DynamoProposalRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn(),
    findLatestByTaskId: vi.fn(),
  })),
}));

vi.mock("./PersonaRenderer.js", () => ({
  PersonaRenderer: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
  })),
}));

vi.mock("../../context-collector/ContextCollector.js", () => ({
  ContextCollector: vi.fn().mockImplementation(() => ({
    getSlackToken: mockGetSlackToken,
  })),
}));

// ─────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────

function makeValidEvent(overrides: Record<string, unknown> = {}): unknown {
  return {
    taskId: "task-001",
    userId: "user-abc",
    task: {
      PK: "USER#user-abc",
      SK: "TASK#task-001",
      taskId: "task-001",
      userId: "user-abc",
      status: "approved",
      title: "週次レポート作成",
      deadline: "2026-05-20T10:00:00.000Z",
      requester: "abc123hash",
      description: "毎週月曜に提出するレポートを作成する",
      sourceType: "slack",
      approvedAt: "2026-05-17T09:00:00Z",
      updatedAt: "2026-05-17T09:00:00Z",
    },
    ...overrides,
  };
}

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    PK: "TASK#task-001",
    SK: "PROPOSAL#2026-05-17T10:00:00.000Z",
    taskId: "task-001",
    userId: "user-abc",
    verdict: "can_saboru",
    summaryText: "まだ寝かせてOK",
    reasoning: ["締切まで余裕があるため"],
    chatMessage: "のんびりしていていいよ〜だよ😴",
    personaId: "saboru_ottori",
    evaluatedAt: "2026-05-17T10:00:00.000Z",
    nextCheckAt: "2026-05-17T14:00:00.000Z",
    tokenCount: 450,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// テスト
// ─────────────────────────────────────────────

describe("SaboriProposerLambdaHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPropose.mockResolvedValue(makeProposal());
  });

  it("returns 200 with proposal body on valid input", async () => {
    const { handler } = await import("../SaboriProposerLambdaHandler.js");
    const event = makeValidEvent();

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(response.body) as Proposal;
    expect(body.verdict).toBe("can_saboru");
    expect(body.taskId).toBe("task-001");
  });

  it("returns 400 when event fails Zod validation (missing taskId)", async () => {
    const { handler } = await import("../SaboriProposerLambdaHandler.js");
    const invalidEvent = { userId: "user-abc" }; // missing taskId and task

    const response = await handler(invalidEvent);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as { error: string };
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 when event is null", async () => {
    const { handler } = await import("../SaboriProposerLambdaHandler.js");

    const response = await handler(null);

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when taskId is empty string", async () => {
    const { handler } = await import("../SaboriProposerLambdaHandler.js");
    const event = makeValidEvent({ taskId: "" });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
  });

  it("calls propose() with correct taskId and TaskContext", async () => {
    const { handler } = await import("../SaboriProposerLambdaHandler.js");
    const event = makeValidEvent();

    await handler(event);

    expect(mockPropose).toHaveBeenCalledOnce();
    const [calledTaskId, calledContext] = mockPropose.mock.calls[0] as [
      string,
      unknown,
    ];
    expect(calledTaskId).toBe("task-001");
    expect(calledContext).toMatchObject({
      task: expect.objectContaining({ taskId: "task-001" }),
    });
  });

  it("proceeds without slackContext when slackMessageRef is not provided", async () => {
    const { handler } = await import("../SaboriProposerLambdaHandler.js");
    const event = makeValidEvent(); // no slackMessageRef

    await handler(event);

    // slackMessageRef がない場合 getSlackToken は呼ばれないべき
    expect(mockGetSlackToken).not.toHaveBeenCalled();
    // slackContext なしで propose() が呼ばれる
    const [, calledContext] = mockPropose.mock.calls[0] as [
      string,
      { slackContext?: unknown },
    ];
    expect(calledContext.slackContext).toBeUndefined();
  });

  it("includes slackContext when slackMessageRef is provided and token fetch succeeds", async () => {
    mockGetSlackToken.mockResolvedValueOnce("xoxb-test-token");

    const { handler } = await import("../SaboriProposerLambdaHandler.js");
    const event = makeValidEvent({
      slackMessageRef: "C123456/1234567890.123456",
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    // getSlackToken が呼ばれるべき
    expect(mockGetSlackToken).toHaveBeenCalledOnce();
    // slackContext 付きで propose() が呼ばれる (最小スタブコンテキスト)
    const [, calledContext] = mockPropose.mock.calls[0] as [
      string,
      { slackContext?: unknown },
    ];
    expect(calledContext.slackContext).toBeDefined();
  });

  it("continues without slackContext when Slack token fetch throws", async () => {
    mockGetSlackToken.mockRejectedValueOnce(new Error("Secrets Manager error"));

    const { handler } = await import("../SaboriProposerLambdaHandler.js");
    const event = makeValidEvent({
      slackMessageRef: "C123456/1234567890.123456",
    });

    // スローせず Slack コンテキストなしで継続する
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    // undefined の slackContext で propose() が呼ばれる (グレースフルデグラデーション)
    const [, calledContext] = mockPropose.mock.calls[0] as [
      string,
      { slackContext?: unknown },
    ];
    expect(calledContext.slackContext).toBeUndefined();
  });

  it("continues without slackContext when Slack token fetch throws non-Error", async () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    mockGetSlackToken.mockRejectedValueOnce("string error");

    const { handler } = await import("../SaboriProposerLambdaHandler.js");
    const event = makeValidEvent({
      slackMessageRef: "C123456/1234567890.123456",
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const [, calledContext] = mockPropose.mock.calls[0] as [
      string,
      { slackContext?: unknown },
    ];
    expect(calledContext.slackContext).toBeUndefined();
  });

  it("propagates error when propose() throws (DynamoDB/Bedrock error)", async () => {
    mockPropose.mockRejectedValueOnce(new Error("DynamoDB connection failed"));

    const { handler } = await import("../SaboriProposerLambdaHandler.js");
    const event = makeValidEvent();

    // Lambda エラーはリトライ/DLQ 処理のため伝播する
    await expect(handler(event)).rejects.toThrow("DynamoDB connection failed");
  });
});
