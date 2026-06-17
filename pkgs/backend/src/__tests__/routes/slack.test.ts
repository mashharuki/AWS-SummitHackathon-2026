/**
 * POST /api/slack/sync-messages のテスト
 *
 * モック対象:
 * - @saboru/agent の getSlackToken / SlackClient
 * - EventBridgeClient.send（DI で注入）
 */

import type { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import type { DynamoProposalRepository } from "../../repositories/DynamoProposalRepository.js";
import type { DynamoTaskRepository } from "../../repositories/DynamoTaskRepository.js";
import type { AppEnv } from "../../types.js";

const {
  mockGetSlackToken,
  mockConversationsHistory,
  mockPostMessage,
  mockConversationsList,
} = vi.hoisted(() => ({
  mockGetSlackToken: vi.fn(),
  mockConversationsHistory: vi.fn(),
  mockPostMessage: vi.fn(),
  mockConversationsList: vi.fn(),
}));

class MockSlackApiError extends Error {
  constructor(
    public readonly slackError: string,
    public readonly method: string,
  ) {
    super(`Slack API error: ${slackError} (${method})`);
    this.name = "SlackApiError";
  }
}

vi.mock("@saboru/agent", () => ({
  getSlackToken: mockGetSlackToken,
  SlackApiError: MockSlackApiError,
  SlackClient: class {
    conversationsHistory = mockConversationsHistory;
    postMessage = mockPostMessage;
    conversationsList = mockConversationsList;
  },
}));

vi.mock("../../config/env.js", () => ({
  env: {
    EVENT_BUS_NAME: "test-bus",
  },
}));

const MOCK_USER_ID = "cognito-slack-test";

interface RepoOverrides {
  taskFindById?: ReturnType<typeof vi.fn>;
  proposalFindLatest?: ReturnType<typeof vi.fn>;
}

function buildApp(ebSend: ReturnType<typeof vi.fn>, repos: RepoOverrides = {}) {
  const ebClient = { send: ebSend } as unknown as EventBridgeClient;
  const taskRepo = {
    findById: repos.taskFindById ?? vi.fn(),
  } as unknown as DynamoTaskRepository;
  const proposalRepo = {
    findLatestByTaskId: repos.proposalFindLatest ?? vi.fn(),
  } as unknown as DynamoProposalRepository;

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    (c as unknown as { env: unknown }).env = {
      requestContext: {
        authorizer: { jwt: { claims: { sub: MOCK_USER_ID } } },
      },
    };
    await next();
  });
  // 動的 import で vi.mock 適用後にルートを読み込む
  return import("../../routes/slack.js").then(({ createSlackRoute }) => {
    app.route("/api/slack", createSlackRoute(taskRepo, proposalRepo, ebClient));
    app.onError(errorHandler);
    return app;
  });
}

describe("POST /api/slack/sync-messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSlackToken.mockResolvedValue("xoxb-test");
  });

  it("queues taskable messages to EventBridge and returns counts", async () => {
    mockConversationsHistory.mockResolvedValueOnce([
      { type: "message", user: "U1", text: "資料作って", ts: "1.1" },
      { type: "message", user: "U2", text: "確認お願いします", ts: "2.2" },
      // 除外対象
      { type: "message", bot_id: "B1", text: "bot post", ts: "3.3" },
      { type: "message", subtype: "channel_join", text: "joined", ts: "4.4" },
      { type: "message", user: "U3", text: "   ", ts: "5.5" },
    ]);
    const ebSend = vi.fn().mockResolvedValue({ FailedEntryCount: 0 });

    const app = await buildApp(ebSend);
    const res = await app.request("/api/slack/sync-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: "C1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scanned).toBe(5);
    expect(body.queued).toBe(2); // taskable は2件のみ
    expect(ebSend).toHaveBeenCalledOnce();
    expect(mockGetSlackToken).toHaveBeenCalledWith(MOCK_USER_ID);
  });

  it("returns queued=0 when no taskable messages", async () => {
    mockConversationsHistory.mockResolvedValueOnce([
      { type: "message", bot_id: "B1", text: "bot", ts: "1.1" },
    ]);
    const ebSend = vi.fn();

    const app = await buildApp(ebSend);
    const res = await app.request("/api/slack/sync-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: "C1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.queued).toBe(0);
    // publish 対象がないので EventBridge は呼ばれない
    expect(ebSend).not.toHaveBeenCalled();
  });

  it("passes oldest and limit to conversationsHistory", async () => {
    mockConversationsHistory.mockResolvedValueOnce([]);
    const ebSend = vi.fn();

    const app = await buildApp(ebSend);
    await app.request("/api/slack/sync-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: "C9",
        oldest: "1700000000.0",
        limit: 20,
      }),
    });

    expect(mockConversationsHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C9",
        oldest: "1700000000.0",
        limit: 20,
      }),
    );
  });

  it("returns 400 for invalid body (missing channelId)", async () => {
    const ebSend = vi.fn();
    const app = await buildApp(ebSend);
    const res = await app.request("/api/slack/sync-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("batches EventBridge entries in groups of 10", async () => {
    // 12件の taskable → 2バッチ（10 + 2）
    const messages = Array.from({ length: 12 }, (_, i) => ({
      type: "message",
      user: `U${i}`,
      text: `task ${i}`,
      ts: `${i}.0`,
    }));
    mockConversationsHistory.mockResolvedValueOnce(messages);
    const ebSend = vi.fn().mockResolvedValue({ FailedEntryCount: 0 });

    const app = await buildApp(ebSend);
    const res = await app.request("/api/slack/sync-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: "C1" }),
    });

    const body = await res.json();
    expect(body.queued).toBe(12);
    expect(ebSend).toHaveBeenCalledTimes(2);
  });
});

describe("POST /api/slack/notify-task", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSlackToken.mockResolvedValue("xoxb-test");
    mockPostMessage.mockResolvedValue({ ts: "9.9" });
  });

  const task = {
    PK: `USER#${MOCK_USER_ID}`,
    SK: "TASK#t1",
    taskId: "t1",
    userId: MOCK_USER_ID,
    status: "approved",
    title: "資料作成",
    deadline: null,
    requester: "",
    description: "",
    sourceType: "slack",
    approvedAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
  };

  it("posts the latest verdict to Slack and returns ts", async () => {
    const taskFindById = vi.fn().mockResolvedValue(task);
    const proposalFindLatest = vi
      .fn()
      .mockResolvedValue({ verdict: "can_saboru" });

    const app = await buildApp(vi.fn(), {
      taskFindById,
      proposalFindLatest,
    });
    const res = await app.request("/api/slack/notify-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: "t1", channelId: "C1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posted).toBe(true);
    expect(body.verdict).toBe("can_saboru");
    // postMessage に verdict 由来のメッセージが渡る
    const arg = mockPostMessage.mock.calls[0][0];
    expect(arg.channel).toBe("C1");
    expect(arg.text).toContain("資料作成");
  });

  it("falls back to borderline when no proposal exists", async () => {
    const taskFindById = vi.fn().mockResolvedValue(task);
    const proposalFindLatest = vi.fn().mockResolvedValue(null);

    const app = await buildApp(vi.fn(), { taskFindById, proposalFindLatest });
    const res = await app.request("/api/slack/notify-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: "t1", channelId: "C1" }),
    });

    const body = await res.json();
    expect(body.verdict).toBe("borderline");
  });

  it("passes threadTs for threaded replies", async () => {
    const taskFindById = vi.fn().mockResolvedValue(task);
    const proposalFindLatest = vi
      .fn()
      .mockResolvedValue({ verdict: "must_do" });

    const app = await buildApp(vi.fn(), { taskFindById, proposalFindLatest });
    await app.request("/api/slack/notify-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: "t1", channelId: "C1", threadTs: "1.1" }),
    });

    expect(mockPostMessage.mock.calls[0][0].thread_ts).toBe("1.1");
  });

  it("returns 404 when the task is not found / not owned", async () => {
    const taskFindById = vi.fn().mockResolvedValue(null);
    const app = await buildApp(vi.fn(), { taskFindById });
    const res = await app.request("/api/slack/notify-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: "missing", channelId: "C1" }),
    });

    expect(res.status).toBe(404);
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid body (missing taskId)", async () => {
    const app = await buildApp(vi.fn());
    const res = await app.request("/api/slack/notify-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: "C1" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/slack/channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSlackToken.mockResolvedValue("xoxb-test");
  });

  it("returns the bot's channels (id, name)", async () => {
    mockConversationsList.mockResolvedValueOnce([
      { id: "C1", name: "all-saborou", is_channel: true },
      { id: "C2", name: "dev", is_channel: true },
    ]);

    const app = await buildApp(vi.fn());
    const res = await app.request("/api/slack/channels", { method: "GET" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channels).toEqual([
      { id: "C1", name: "all-saborou" },
      { id: "C2", name: "dev" },
    ]);
    expect(mockGetSlackToken).toHaveBeenCalledWith(MOCK_USER_ID);
  });
});

describe("POST /api/slack/reply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSlackToken.mockResolvedValue("xoxb-test");
    mockPostMessage.mockResolvedValue({ ts: "12.34" });
  });

  it("posts the approved reply text and returns ts", async () => {
    const app = await buildApp(vi.fn());
    const res = await app.request("/api/slack/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: "t1",
        replyText: "承知しました。引き続き対応いたします。",
        channelId: "C1",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ts).toBe("12.34");
    expect(body.taskId).toBe("t1");
    expect(mockGetSlackToken).toHaveBeenCalledWith(MOCK_USER_ID);
    const arg = mockPostMessage.mock.calls[0][0];
    expect(arg.channel).toBe("C1");
    expect(arg.text).toBe("承知しました。引き続き対応いたします。");
  });

  it("passes threadTs for threaded replies", async () => {
    const app = await buildApp(vi.fn());
    await app.request("/api/slack/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replyText: "了解です",
        channelId: "C1",
        threadTs: "1.1",
      }),
    });

    expect(mockPostMessage.mock.calls[0][0].thread_ts).toBe("1.1");
  });

  it("works without taskId (taskId is optional)", async () => {
    const app = await buildApp(vi.fn());
    const res = await app.request("/api/slack/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replyText: "OKです", channelId: "C1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.taskId).toBeUndefined();
  });

  it("returns 400 when replyText is missing", async () => {
    const app = await buildApp(vi.fn());
    const res = await app.request("/api/slack/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: "C1" }),
    });
    expect(res.status).toBe(400);
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("returns 400 when channelId is missing", async () => {
    const app = await buildApp(vi.fn());
    const res = await app.request("/api/slack/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replyText: "hello" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 502 when Slack API fails", async () => {
    mockPostMessage.mockRejectedValueOnce(
      new MockSlackApiError("channel_not_found", "chat.postMessage"),
    );
    const app = await buildApp(vi.fn());
    const res = await app.request("/api/slack/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replyText: "hi", channelId: "C-bad" }),
    });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("SLACK_API_ERROR");
  });
});

describe("POST /api/slack/delegations", () => {
  const task = {
    PK: `USER#${MOCK_USER_ID}`,
    SK: "TASK#t1",
    taskId: "t1",
    userId: MOCK_USER_ID,
    status: "approved",
    title: "決勝デモの台本作成",
    deadline: "2026-06-26T09:00:00+09:00",
    requester: "PM",
    description: "AWS Summit Japan 2026 決勝デモ用の説明台本を準備する",
    sourceType: "slack",
    approvedAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSlackToken.mockResolvedValue("xoxb-test");
    mockPostMessage.mockResolvedValue({ ts: "22.22" });
  });

  it("posts an approved Claude delegation message", async () => {
    const taskFindById = vi.fn().mockResolvedValue(task);
    const app = await buildApp(vi.fn(), { taskFindById });

    const res = await app.request("/api/slack/delegations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: "t1",
        channelId: "C12345",
        threadTs: "1718600000.123456",
        instruction: "短い初稿をお願いします",
        approved: true,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      taskId: "t1",
      channelId: "C12345",
      ts: "22.22",
    });
    expect(taskFindById).toHaveBeenCalledWith(MOCK_USER_ID, "t1");
    expect(mockGetSlackToken).toHaveBeenCalledWith(MOCK_USER_ID);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C12345",
        thread_ts: "1718600000.123456",
      }),
    );
    expect(mockPostMessage.mock.calls[0][0].text).toContain("@Claude");
    expect(mockPostMessage.mock.calls[0][0].text).toContain(
      "決勝デモの台本作成",
    );
  });

  it("returns 403 and does not touch Slack when approval is missing", async () => {
    const taskFindById = vi.fn().mockResolvedValue(task);
    const app = await buildApp(vi.fn(), { taskFindById });

    const res = await app.request("/api/slack/delegations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: "t1", channelId: "C12345" }),
    });

    expect(res.status).toBe(403);
    expect(taskFindById).not.toHaveBeenCalled();
    expect(mockGetSlackToken).not.toHaveBeenCalled();
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("returns 404 for missing or wrong-owner tasks without posting", async () => {
    const taskFindById = vi.fn().mockResolvedValue(null);
    const app = await buildApp(vi.fn(), { taskFindById });

    const res = await app.request("/api/slack/delegations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: "missing",
        channelId: "C12345",
        approved: true,
      }),
    });

    expect(res.status).toBe(404);
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid delegation input", async () => {
    const app = await buildApp(vi.fn());

    const res = await app.request("/api/slack/delegations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: "<script>",
        channelId: "C12345",
        approved: true,
      }),
    });

    expect(res.status).toBe(400);
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("returns a safe 502 when Slack API fails", async () => {
    mockPostMessage.mockRejectedValueOnce(
      new MockSlackApiError("channel_not_found", "chat.postMessage"),
    );
    const taskFindById = vi.fn().mockResolvedValue(task);
    const app = await buildApp(vi.fn(), { taskFindById });

    const res = await app.request("/api/slack/delegations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: "t1",
        channelId: "C12345",
        approved: true,
      }),
    });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("SLACK_API_ERROR");
    expect(JSON.stringify(body)).not.toContain("xoxb-test");
  });
});
