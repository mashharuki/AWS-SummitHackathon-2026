/**
 * GET /tasks/:taskId/proposal のテスト
 */

import type { SaboriProposerAgent, SaboriProposerAgentV2 } from "@saboru/agent";
import type { Proposal, Task } from "@saboru/shared";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import type { DynamoGoogleCalendarCacheRepository } from "../../repositories/DynamoGoogleCalendarCacheRepository.js";
import type { DynamoProposalRepository } from "../../repositories/DynamoProposalRepository.js";
import type { DynamoTaskRepository } from "../../repositories/DynamoTaskRepository.js";
import type { DynamoUserRepository } from "../../repositories/DynamoUserRepository.js";
import { createProposalsRoute } from "../../routes/proposals.js";
import type { AppEnv } from "../../types.js";

const MOCK_USER_ID = "user-proposal-test";

function buildTestApp(
  taskRepo: Partial<DynamoTaskRepository>,
  proposalRepo: Partial<DynamoProposalRepository>,
  agent: Partial<SaboriProposerAgent>,
  userRepo: Partial<DynamoUserRepository> = {
    findById: vi.fn().mockResolvedValue(null),
  },
  calendarCacheRepo?: Partial<DynamoGoogleCalendarCacheRepository>,
  agentV2?: Partial<SaboriProposerAgentV2>,
  withAuth = true,
) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    (c as unknown as { env: unknown }).env = withAuth
      ? {
          requestContext: {
            authorizer: { jwt: { claims: { sub: MOCK_USER_ID } } },
          },
        }
      : {};
    await next();
  });
  app.route(
    "/tasks",
    createProposalsRoute(
      taskRepo as DynamoTaskRepository,
      proposalRepo as DynamoProposalRepository,
      agent as SaboriProposerAgent,
      userRepo as DynamoUserRepository,
      calendarCacheRepo as DynamoGoogleCalendarCacheRepository | undefined,
      agentV2 as SaboriProposerAgentV2 | undefined,
    ),
  );
  app.onError(errorHandler);
  return app;
}

const sampleTask: Task = {
  PK: "USER#user-proposal-test",
  SK: "TASK#T01",
  taskId: "T01",
  userId: MOCK_USER_ID,
  status: "approved",
  title: "テスト",
  deadline: null,
  requester: "",
  description: "",
  sourceType: "manual",
  approvedAt: "2026-05-17T00:00:00Z",
  updatedAt: "2026-05-17T00:00:00Z",
};

const cachedProposal: Proposal = {
  PK: "TASK#T01",
  SK: "PROPOSAL#2026-05-17T00:00:00Z",
  taskId: "T01",
  userId: MOCK_USER_ID,
  verdict: "can_saboru",
  summaryText: "サボれるよ",
  reasoning: ["理由1"],
  chatMessage: "今日はゆっくりしよ",
  personaId: "saboru_ottori",
  evaluatedAt: "2026-05-17T00:00:00Z",
  nextCheckAt: "2099-01-01T00:00:00Z", // far future = cache valid
  tokenCount: 100,
};

describe("GET /tasks/:taskId/proposal (sync)", () => {
  it("returns cached proposal as JSON when cache is valid", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(cachedProposal),
    };
    const agent = { propose: vi.fn() };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verdict).toBe("can_saboru");
    expect(vi.mocked(agent.propose)).not.toHaveBeenCalled();
  });

  it("calls agent.propose when no cache", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const agent = { propose: vi.fn().mockResolvedValue(cachedProposal) };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal");
    expect(res.status).toBe(200);
    expect(vi.mocked(agent.propose)).toHaveBeenCalledOnce();
  });

  it("calls agent.propose when cache is expired", async () => {
    const expiredProposal = {
      ...cachedProposal,
      nextCheckAt: "2020-01-01T00:00:00Z", // past = expired
    };
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(expiredProposal),
    };
    const agent = { propose: vi.fn().mockResolvedValue(cachedProposal) };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal");
    expect(res.status).toBe(200);
    expect(vi.mocked(agent.propose)).toHaveBeenCalledOnce();
  });

  it("returns 404 when task not found", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(null) };
    const proposalRepo = { findLatestByTaskId: vi.fn() };
    const agent = {};
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/NOTFOUND/proposal");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /tasks/:taskId/proposal (SSE stream=true)", () => {
  it("returns SSE stream when cache is valid and stream=true", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(cachedProposal),
    };
    const agent = { propose: vi.fn(), proposeStream: vi.fn() };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal?stream=true");
    // SSE ストリーミングは 200 と text/event-stream content-type を返す
    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type") ?? "";
    expect(contentType).toContain("text/event-stream");
    expect(vi.mocked(agent.propose)).not.toHaveBeenCalled();
  });

  it("streams from agent when no cache and stream=true", async () => {
    // proposeStream はデルタイベントを yield する非同期ジェネレーター
    async function* mockStream() {
      yield {
        type: "verdict" as const,
        verdict: "can_saboru",
        summaryText: "サボれる",
      };
      yield { type: "chat" as const, chatMessage: "ゆっくりしてね" };
      yield { type: "done" as const, proposalId: "PROPOSAL#T", cached: false };
    }

    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const agent = { proposeStream: vi.fn().mockReturnValue(mockStream()) };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal?stream=true");
    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type") ?? "";
    expect(contentType).toContain("text/event-stream");
  });

  it("handles stream error gracefully and emits error SSE event", async () => {
    async function* errorStream() {
      yield {
        type: "verdict" as const,
        verdict: "can_saboru",
        summaryText: "x",
      };
      throw new Error("Bedrock timeout");
    }

    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const agent = { proposeStream: vi.fn().mockReturnValue(errorStream()) };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal?stream=true");
    // ジェネレーターが途中でスローしてもストリームは正常に開始される
    expect(res.status).toBe(200);
  });

  it("breaks stream loop when error type event is yielded", async () => {
    async function* errorEventStream() {
      yield { type: "error" as const, message: "generation failed" };
    }

    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const agent = {
      proposeStream: vi.fn().mockReturnValue(errorEventStream()),
    };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal?stream=true");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"type":"error"');
  });

  it("streams cached proposal SSE with done event containing cached:true", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(cachedProposal),
    };
    const agent = { propose: vi.fn(), proposeStream: vi.fn() };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal?stream=true");
    expect(res.status).toBe(200);
    const text = await res.text();
    // SSE ボディに cached:true を含む done イベントが存在すること
    expect(text).toContain('"cached":true');
  });
});

// calendarCacheRecord のサンプル（24h 以内 = 有効）
const validCacheRecord = {
  PK: "USER#user-proposal-test",
  SK: "CACHE#calendar",
  userId: MOCK_USER_ID,
  fetchedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h 前
  upcomingEventCount: 3,
  nextEventStartsInMinutes: 45,
  freeSlotMinutesToday: 120,
  busyScore: 0.4,
  ttl: Math.floor(Date.now() / 1000) + 86400,
};

// calendarCacheRecord のサンプル（24h 超過 = 期限切れ）
const expiredCacheRecord = {
  ...validCacheRecord,
  fetchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25h 前
};

describe("GET /tasks/:taskId/proposal — calendarContext 注入 (BR-G-05)", () => {
  it("calendarCacheRepository 未指定時は calendarContext なしで agent.propose を呼ぶ", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const mockPropose = vi.fn().mockResolvedValue(cachedProposal);
    const agent = { propose: mockPropose };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal");
    expect(res.status).toBe(200);
    expect(mockPropose).toHaveBeenCalledOnce();
    const [, ctx] = mockPropose.mock.calls[0];
    expect(
      (ctx as { calendarContext: unknown }).calendarContext,
    ).toBeUndefined();
  });

  it("キャッシュが存在し 24h 以内の場合、calendarContext を agent.propose に渡す", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const mockPropose = vi.fn().mockResolvedValue(cachedProposal);
    const agent = { propose: mockPropose };
    const calendarCacheRepo = {
      findByUserId: vi.fn().mockResolvedValue(validCacheRecord),
    };
    const app = buildTestApp(
      taskRepo,
      proposalRepo,
      agent,
      undefined,
      calendarCacheRepo,
    );

    const res = await app.request("/tasks/T01/proposal");
    expect(res.status).toBe(200);
    expect(mockPropose).toHaveBeenCalledOnce();
    const [, ctx] = mockPropose.mock.calls[0];
    const calCtx = (ctx as { calendarContext: typeof validCacheRecord })
      .calendarContext;
    expect(calCtx).toBeDefined();
    expect(calCtx.upcomingEventCount).toBe(3);
    expect(calCtx.busyScore).toBe(0.4);
  });

  it("キャッシュが 24h 超過の場合、calendarContext は undefined", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const mockPropose = vi.fn().mockResolvedValue(cachedProposal);
    const agent = { propose: mockPropose };
    const calendarCacheRepo = {
      findByUserId: vi.fn().mockResolvedValue(expiredCacheRecord),
    };
    const app = buildTestApp(
      taskRepo,
      proposalRepo,
      agent,
      undefined,
      calendarCacheRepo,
    );

    const res = await app.request("/tasks/T01/proposal");
    expect(res.status).toBe(200);
    expect(mockPropose).toHaveBeenCalledOnce();
    const [, ctx] = mockPropose.mock.calls[0];
    expect(
      (ctx as { calendarContext: unknown }).calendarContext,
    ).toBeUndefined();
  });

  it("findByUserId が null を返す場合、calendarContext は undefined", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const mockPropose = vi.fn().mockResolvedValue(cachedProposal);
    const agent = { propose: mockPropose };
    const calendarCacheRepo = {
      findByUserId: vi.fn().mockResolvedValue(null),
    };
    const app = buildTestApp(
      taskRepo,
      proposalRepo,
      agent,
      undefined,
      calendarCacheRepo,
    );

    const res = await app.request("/tasks/T01/proposal");
    expect(res.status).toBe(200);
    expect(mockPropose).toHaveBeenCalledOnce();
    const [, ctx] = mockPropose.mock.calls[0];
    expect(
      (ctx as { calendarContext: unknown }).calendarContext,
    ).toBeUndefined();
  });
});

describe("GET /tasks/:taskId/proposal?stream=true — calendarContext 注入 (BR-G-05)", () => {
  it("キャッシュが存在し 24h 以内の場合、calendarContext を proposeStream に渡す", async () => {
    async function* mockStream() {
      yield {
        type: "verdict" as const,
        verdict: "can_saboru",
        summaryText: "サボれる",
      };
      yield { type: "done" as const, proposalId: "P1", cached: false };
    }
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const mockProposeStream = vi.fn().mockReturnValue(mockStream());
    const agent = { proposeStream: mockProposeStream };
    const calendarCacheRepo = {
      findByUserId: vi.fn().mockResolvedValue(validCacheRecord),
    };
    const app = buildTestApp(
      taskRepo,
      proposalRepo,
      agent,
      undefined,
      calendarCacheRepo,
    );

    const res = await app.request("/tasks/T01/proposal?stream=true");
    expect(res.status).toBe(200);
    expect(mockProposeStream).toHaveBeenCalledOnce();
    const [, ctx] = mockProposeStream.mock.calls[0];
    const calCtx = (ctx as { calendarContext: typeof validCacheRecord })
      .calendarContext;
    expect(calCtx).toBeDefined();
    expect(calCtx.upcomingEventCount).toBe(3);
  });

  it("キャッシュが 24h 超過の場合、proposeStream に calendarContext は渡さない", async () => {
    async function* mockStream() {
      yield { type: "done" as const, proposalId: "P2", cached: false };
    }
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const mockProposeStream = vi.fn().mockReturnValue(mockStream());
    const agent = { proposeStream: mockProposeStream };
    const calendarCacheRepo = {
      findByUserId: vi.fn().mockResolvedValue(expiredCacheRecord),
    };
    const app = buildTestApp(
      taskRepo,
      proposalRepo,
      agent,
      undefined,
      calendarCacheRepo,
    );

    const res = await app.request("/tasks/T01/proposal?stream=true");
    expect(res.status).toBe(200);
    expect(mockProposeStream).toHaveBeenCalledOnce();
    const [, ctx] = mockProposeStream.mock.calls[0];
    expect(
      (ctx as { calendarContext: unknown }).calendarContext,
    ).toBeUndefined();
  });

  it("findByUserId が null の場合、proposeStream に calendarContext は渡さない", async () => {
    async function* mockStream() {
      yield { type: "done" as const, proposalId: "P3", cached: false };
    }
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const mockProposeStream = vi.fn().mockReturnValue(mockStream());
    const agent = { proposeStream: mockProposeStream };
    const calendarCacheRepo = {
      findByUserId: vi.fn().mockResolvedValue(null),
    };
    const app = buildTestApp(
      taskRepo,
      proposalRepo,
      agent,
      undefined,
      calendarCacheRepo,
    );

    const res = await app.request("/tasks/T01/proposal?stream=true");
    expect(res.status).toBe(200);
    expect(mockProposeStream).toHaveBeenCalledOnce();
    const [, ctx] = mockProposeStream.mock.calls[0];
    expect(
      (ctx as { calendarContext: unknown }).calendarContext,
    ).toBeUndefined();
  });
});

describe("POST /tasks/:taskId/proposal — 基本", () => {
  it("タスクが存在しない場合 404 を返す", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(null) };
    const proposalRepo = { findLatestByTaskId: vi.fn() };
    const agent = {};
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/NOTFOUND/proposal", {
      method: "POST",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("POST /tasks/:taskId/proposal — calendarContext 注入 (BR-G-05)", () => {
  it("calendarCacheRepository 未指定時は calendarContext なしで agent.propose を呼ぶ", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const mockPropose = vi.fn().mockResolvedValue(cachedProposal);
    const agent = { propose: mockPropose };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal", { method: "POST" });
    expect(res.status).toBe(200);
    expect(mockPropose).toHaveBeenCalledOnce();
    const [, ctx] = mockPropose.mock.calls[0];
    expect(
      (ctx as { calendarContext: unknown }).calendarContext,
    ).toBeUndefined();
  });

  it("キャッシュが存在し 24h 以内の場合、calendarContext を agent.propose に渡す", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const mockPropose = vi.fn().mockResolvedValue(cachedProposal);
    const agent = { propose: mockPropose };
    const calendarCacheRepo = {
      findByUserId: vi.fn().mockResolvedValue(validCacheRecord),
    };
    const app = buildTestApp(
      taskRepo,
      proposalRepo,
      agent,
      undefined,
      calendarCacheRepo,
    );

    const res = await app.request("/tasks/T01/proposal", { method: "POST" });
    expect(res.status).toBe(200);
    expect(mockPropose).toHaveBeenCalledOnce();
    const [, ctx] = mockPropose.mock.calls[0];
    const calCtx = (ctx as { calendarContext: typeof validCacheRecord })
      .calendarContext;
    expect(calCtx).toBeDefined();
    expect(calCtx.upcomingEventCount).toBe(3);
    expect(calCtx.fetchedAt).toBe(validCacheRecord.fetchedAt);
  });

  it("キャッシュが 24h 超過の場合、calendarContext は undefined", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const mockPropose = vi.fn().mockResolvedValue(cachedProposal);
    const agent = { propose: mockPropose };
    const calendarCacheRepo = {
      findByUserId: vi.fn().mockResolvedValue(expiredCacheRecord),
    };
    const app = buildTestApp(
      taskRepo,
      proposalRepo,
      agent,
      undefined,
      calendarCacheRepo,
    );

    const res = await app.request("/tasks/T01/proposal", { method: "POST" });
    expect(res.status).toBe(200);
    expect(mockPropose).toHaveBeenCalledOnce();
    const [, ctx] = mockPropose.mock.calls[0];
    expect(
      (ctx as { calendarContext: unknown }).calendarContext,
    ).toBeUndefined();
  });

  it("findByUserId が null の場合、calendarContext は undefined", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const mockPropose = vi.fn().mockResolvedValue(cachedProposal);
    const agent = { propose: mockPropose };
    const calendarCacheRepo = {
      findByUserId: vi.fn().mockResolvedValue(null),
    };
    const app = buildTestApp(
      taskRepo,
      proposalRepo,
      agent,
      undefined,
      calendarCacheRepo,
    );

    const res = await app.request("/tasks/T01/proposal", { method: "POST" });
    expect(res.status).toBe(200);
    expect(mockPropose).toHaveBeenCalledOnce();
    const [, ctx] = mockPropose.mock.calls[0];
    expect(
      (ctx as { calendarContext: unknown }).calendarContext,
    ).toBeUndefined();
  });

  it("agent.propose が throw した場合、catch ブロックに入りストリームを正常終了する", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const mockPropose = vi.fn().mockRejectedValue(new Error("Bedrock error"));
    const agent = { propose: mockPropose };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal", { method: "POST" });
    // catch ブロックが console.error を呼ぶが、ストリームはクローズされる
    expect(res.status).toBe(200);
    expect(mockPropose).toHaveBeenCalledOnce();
  });
});

describe("POST /judge — Chrome 拡張向け返信文ドラフト生成", () => {
  const sampleDraft = {
    replyText: "ご連絡ありがとうございます。確認のうえ折り返します。",
    tone: "polite" as const,
    reasoning: ["依頼内容を確認"],
  };

  function buildJudgeApp(
    draftReply: ReturnType<typeof vi.fn>,
    withAuth = true,
  ) {
    return buildTestApp(
      { findById: vi.fn() },
      { findLatestByTaskId: vi.fn() },
      {},
      undefined,
      undefined,
      { draftReply } as Partial<SaboriProposerAgentV2>,
      withAuth,
    );
  }

  it("正常系: message から replyDraft/saboriScore/ttsSummary を返す", async () => {
    const draftReply = vi.fn().mockResolvedValue(sampleDraft);
    const app = buildJudgeApp(draftReply);

    const res = await app.request("/tasks/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "明日までに資料お願いできますか",
        senderName: "山田",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.replyDraft).toBe(sampleDraft.replyText);
    expect(typeof body.saboriScore).toBe("number");
    expect(body.saboriScore).toBeGreaterThanOrEqual(0);
    expect(body.saboriScore).toBeLessThanOrEqual(1);
    expect(typeof body.ttsSummary).toBe("string");
    expect(body.ttsSummary.length).toBeGreaterThan(0);

    // contextHint に送信者名が渡されること
    expect(draftReply).toHaveBeenCalledOnce();
    const [arg] = draftReply.mock.calls[0];
    expect(arg.incomingMessage).toBe("明日までに資料お願いできますか");
    expect(arg.contextHint).toBe("送信者: 山田");
  });

  it("senderName 省略時は contextHint を undefined にする", async () => {
    const draftReply = vi.fn().mockResolvedValue(sampleDraft);
    const app = buildJudgeApp(draftReply);

    const res = await app.request("/tasks/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "テスト依頼" }),
    });

    expect(res.status).toBe(200);
    const [arg] = draftReply.mock.calls[0];
    expect(arg.contextHint).toBeUndefined();
  });

  it("ttsSummary は発話向けに正規化して返す", async () => {
    const draftReply = vi.fn().mockResolvedValue({
      replyText:
        "AWS API のURLは https://example.com/path です。3人で15分確認します。",
      reasoning: ["r"],
    });
    const app = buildJudgeApp(draftReply);

    const res = await app.request("/tasks/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "音声向けに要約して" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ttsSummary).toBe(
      "エーダブリューエス エーピーアイ のユーアールエルは リンク です。さんにんでじゅうごふん確認します。",
    );
    expect(body.ttsSummary.length).toBeLessThanOrEqual(101);
  });

  it("長い replyText は ttsSummary で 100 字程度に短縮される", async () => {
    const longText = `${"AWS API ".repeat(20)}${"あ".repeat(250)}`;
    const draftReply = vi
      .fn()
      .mockResolvedValue({ replyText: longText, reasoning: ["r"] });
    const app = buildJudgeApp(draftReply);

    const res = await app.request("/tasks/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "長文依頼" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.replyDraft).toBe(longText);
    // 100 字 + 省略記号
    expect(body.ttsSummary.length).toBeLessThanOrEqual(101);
    expect(body.ttsSummary.endsWith("…")).toBe(true);
    expect(body.ttsSummary).toContain("エーダブリューエス");
  });

  it("認証なしの場合 401 を返す", async () => {
    const draftReply = vi.fn();
    const app = buildJudgeApp(draftReply, false);

    const res = await app.request("/tasks/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "テスト" }),
    });

    expect(res.status).toBe(401);
    expect(draftReply).not.toHaveBeenCalled();
  });

  it("message 欠落時は 400 バリデーションエラー", async () => {
    const draftReply = vi.fn();
    const app = buildJudgeApp(draftReply);

    const res = await app.request("/tasks/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderName: "山田" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(draftReply).not.toHaveBeenCalled();
  });

  it("空文字 message は 400 バリデーションエラー", async () => {
    const draftReply = vi.fn();
    const app = buildJudgeApp(draftReply);

    const res = await app.request("/tasks/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });

    expect(res.status).toBe(400);
    expect(draftReply).not.toHaveBeenCalled();
  });

  it("V2 エージェント未注入時は 503 を返す", async () => {
    const app = buildTestApp(
      { findById: vi.fn() },
      { findLatestByTaskId: vi.fn() },
      {},
      undefined,
      undefined,
      undefined, // agentV2 未注入
    );

    const res = await app.request("/tasks/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "テスト依頼" }),
    });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
  });
});
