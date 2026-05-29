import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TaskExtractorLambdaHandler ユニットテスト
 *
 * 方針: vi.mock() でインポートモジュールをモック化し、
 * モジュールレベルシングルトン（BedrockClientAdapter、DynamoTaskCandidateRepository）を別離する。
 *
 * 実障の Bedrock および DynamoDB 呼び出しは行わない。
 */

// ─────────────────────────────────────────────
// モジュールモック（ホイスト済み）
// ─────────────────────────────────────────────

const mockConverse = vi.fn();
const mockCreate = vi.fn();
const mockFindCognitoSub = vi.fn();
const mockGetSlackToken = vi.fn();
const mockUsersInfo = vi.fn();

vi.mock("../../bedrock/BedrockClientAdapter.js", () => ({
  BedrockClientAdapter: vi.fn(() => ({
    converse: mockConverse,
  })),
}));

vi.mock("../../repositories/DynamoSlackUserLookupRepository.js", () => ({
  DynamoSlackUserLookupRepository: vi.fn(() => ({
    findCognitoSubBySlackIdentity: mockFindCognitoSub,
  })),
}));

// 表示名リゾルバ用: getSlackToken と SlackClient.usersInfo をモック化し、
// 実 Secrets Manager / Slack API を呼ばないようにする。
vi.mock("../../context-collector/ContextCollector.js", () => ({
  getSlackToken: mockGetSlackToken,
}));

vi.mock("../../slack-client/SlackClient.js", () => ({
  SlackClient: vi.fn(() => ({
    usersInfo: mockUsersInfo,
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
// ヘルパー
// ─────────────────────────────────────────────

function makeToolUseResponse(
  overrides: {
    is_task?: boolean;
    title?: string;
    deadline?: string | null;
    requester?: string;
    assignee?: string;
    description?: string;
  } = {},
) {
  const input = {
    is_task: true,
    title: "資料を作成する",
    deadline: "2026-05-25",
    requester: "U99999",
    assignee: "",
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

// 実際の Lambda が受け取る EventBridge エンベロープ形式
const validEvent = {
  source: "saborou.webhook",
  "detail-type": "SlackEvent",
  detail: {
    event: {
      type: "message",
      text: "月曜までに資料を作っておいてください。",
      user: "U99999",
      channel: "C12345",
      ts: "1234567890.123456",
      team: "T12345",
    },
    teamId: "T12345",
    receivedAt: "2026-05-23T00:00:00.000Z",
  },
};

// ─────────────────────────────────────────────
// テスト
// ─────────────────────────────────────────────

describe("TaskExtractorLambdaHandler", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.PSEUDONYMIZE_SALT = "test-salt-1234567";
    process.env.BEDROCK_REGION = "ap-northeast-1";
    // デフォルト: Slack identity は連携済みユーザーに解決される
    mockFindCognitoSub.mockResolvedValue("cognito-user-abc");
    // デフォルト: Bot Token 取得成功・表示名は解決できない（ID フォールバック）
    mockGetSlackToken.mockResolvedValue("xoxb-test");
    mockUsersInfo.mockResolvedValue(null);
  });

  it("processes a valid task event without throwing", async () => {
    mockConverse.mockResolvedValueOnce(makeToolUseResponse());

    const { handler } = await import("../TaskExtractorLambdaHandler.js");
    await expect(handler(validEvent)).resolves.toBeUndefined();
    expect(mockConverse).toHaveBeenCalledOnce();
    // teamId + Slack user で逆引きが行われる
    expect(mockFindCognitoSub).toHaveBeenCalledWith("T12345", "U99999");
  });

  it("includes threadTs when the Slack event has thread_ts", async () => {
    mockConverse.mockResolvedValueOnce(makeToolUseResponse());

    const threadedEvent = {
      source: "saborou.webhook",
      "detail-type": "SlackEvent",
      detail: {
        event: {
          type: "message",
          text: "スレッド内の依頼です。",
          user: "U99999",
          channel: "C12345",
          ts: "1234567890.123456",
          thread_ts: "1234567880.000000",
          team: "T12345",
        },
        teamId: "T12345",
        receivedAt: "2026-05-23T00:00:00.000Z",
      },
    };

    const { handler } = await import("../TaskExtractorLambdaHandler.js");
    await expect(handler(threadedEvent)).resolves.toBeUndefined();
    expect(mockConverse).toHaveBeenCalledOnce();
  });

  it("skips when the Slack user is not linked to any Cognito user", async () => {
    mockFindCognitoSub.mockResolvedValueOnce(null);

    const { handler } = await import("../TaskExtractorLambdaHandler.js");
    await expect(handler(validEvent)).resolves.toBeUndefined();
    // 逆引き失敗 → Bedrock も永続化も呼ばれない
    expect(mockConverse).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns without error for invalid EventBridge payload (no DLQ)", async () => {
    const { handler } = await import("../TaskExtractorLambdaHandler.js");

    // 不正なペイロード — 必須フィールドがない
    const malformed = { source: "slack", userId: "" };
    await expect(handler(malformed)).resolves.toBeUndefined();

    // Bedrock は呼ばれていないべき
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
    // createTaskCandidateWithUserId (create を呼び出す) は呼ばれないべき
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("propagates Bedrock errors (allows Lambda retry / DLQ)", async () => {
    mockConverse.mockRejectedValueOnce(new Error("ThrottlingException"));

    const { handler } = await import("../TaskExtractorLambdaHandler.js");
    await expect(handler(validEvent)).rejects.toThrow("ThrottlingException");
  });

  it("uses default BEDROCK_REGION when env var is missing", async () => {
    // biome-ignore lint/performance/noDelete: env var の真の削除には delete が必要
    delete process.env.BEDROCK_REGION;
    vi.resetModules();

    const { BedrockClientAdapter } = await import(
      "../../bedrock/BedrockClientAdapter.js"
    );
    const BedrockCtor = vi.mocked(BedrockClientAdapter);

    mockConverse.mockResolvedValueOnce(makeToolUseResponse());
    const { handler } = await import("../TaskExtractorLambdaHandler.js");
    await expect(handler(validEvent)).resolves.toBeUndefined();

    expect(BedrockCtor).toHaveBeenCalledWith("ap-northeast-1");
  });

  it("skips bot/subtype messages (no lookup, no Bedrock)", async () => {
    const botEvent = {
      source: "saborou.webhook",
      "detail-type": "SlackEvent",
      detail: {
        event: {
          type: "message",
          subtype: "bot_message",
          bot_id: "B123",
          text: "自動投稿",
          user: "U99999",
          channel: "C12345",
          ts: "1234567890.123456",
          team: "T12345",
        },
        teamId: "T12345",
        receivedAt: "2026-05-23T00:00:00.000Z",
      },
    };

    const { handler } = await import("../TaskExtractorLambdaHandler.js");
    await expect(handler(botEvent)).resolves.toBeUndefined();
    expect(mockFindCognitoSub).not.toHaveBeenCalled();
    expect(mockConverse).not.toHaveBeenCalled();
  });

  it("skips messages with incomplete fields (missing text)", async () => {
    const incompleteEvent = {
      source: "saborou.webhook",
      "detail-type": "SlackEvent",
      detail: {
        event: {
          type: "message",
          text: "",
          user: "U99999",
          channel: "C12345",
          ts: "1234567890.123456",
          team: "T12345",
        },
        teamId: "T12345",
        receivedAt: "2026-05-23T00:00:00.000Z",
      },
    };

    const { handler } = await import("../TaskExtractorLambdaHandler.js");
    await expect(handler(incompleteEvent)).resolves.toBeUndefined();
    expect(mockFindCognitoSub).not.toHaveBeenCalled();
    expect(mockConverse).not.toHaveBeenCalled();
  });

  // ── SlackBackfill 経路（遡及取得 API 由来・cognitoSub 直接） ──

  const validBackfillEvent = {
    source: "saborou.backend",
    "detail-type": "SlackBackfill",
    detail: {
      userId: "cognito-user-abc",
      message: {
        text: "遡及取得した依頼です。",
        channel: "C12345",
        ts: "1234567890.123456",
        user: "U99999",
        team: "T12345",
      },
      receivedAt: "2026-05-23T00:00:00.000Z",
    },
  };

  it("processes a backfill event without reverse lookup", async () => {
    mockConverse.mockResolvedValueOnce(makeToolUseResponse());

    const { handler } = await import("../TaskExtractorLambdaHandler.js");
    await expect(handler(validBackfillEvent)).resolves.toBeUndefined();
    // backfill は cognitoSub を直接持つので逆引きは呼ばれない
    expect(mockFindCognitoSub).not.toHaveBeenCalled();
    expect(mockConverse).toHaveBeenCalledOnce();
  });

  it("includes threadTs for backfill events with thread_ts", async () => {
    mockConverse.mockResolvedValueOnce(makeToolUseResponse());

    const threadedBackfill = {
      ...validBackfillEvent,
      detail: {
        ...validBackfillEvent.detail,
        message: {
          ...validBackfillEvent.detail.message,
          thread_ts: "1234567880.000000",
        },
      },
    };

    const { handler } = await import("../TaskExtractorLambdaHandler.js");
    await expect(handler(threadedBackfill)).resolves.toBeUndefined();
    expect(mockConverse).toHaveBeenCalledOnce();
  });
});
