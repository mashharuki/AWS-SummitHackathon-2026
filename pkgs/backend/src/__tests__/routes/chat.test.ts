/**
 * POST /api/chat のテスト（余白タブ サボロー対話）
 *
 * schedule.test.ts のテストアプリ構築パターンを踏襲。
 * SaborouChatAgent・honneRepository・userRepository は Partial / vi.fn で注入する。
 */

import type { SaborouChatAgent, SaborouChatOutput } from "@saboru/agent";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import type { DynamoHonneRepository } from "../../repositories/DynamoHonneRepository.js";
import type { DynamoUserRepository } from "../../repositories/DynamoUserRepository.js";
import { createChatRoute } from "../../routes/chat.js";
import type { AppEnv } from "../../types.js";

const MOCK_USER_ID = "user-chat-test";

function buildTestApp(
  agent: Partial<SaborouChatAgent>,
  honneRepo: Partial<DynamoHonneRepository> = {
    findAllByUserId: vi.fn().mockResolvedValue([]),
  },
  userRepo: Partial<DynamoUserRepository> = {
    findById: vi.fn().mockResolvedValue(null),
  },
) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    (c as unknown as { env: unknown }).env = {
      requestContext: {
        authorizer: { jwt: { claims: { sub: MOCK_USER_ID } } },
      },
    };
    await next();
  });
  app.route(
    "/chat",
    createChatRoute(
      agent as SaborouChatAgent,
      honneRepo as DynamoHonneRepository,
      userRepo as DynamoUserRepository,
    ),
  );
  app.onError(errorHandler);
  return app;
}

function post(app: Hono<AppEnv>, body: unknown) {
  return app.request("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  it("サボローの返答（reply / action）を返す", async () => {
    const out: SaborouChatOutput = {
      reply: "ここはサボっていいよ。",
      action: "progress_report",
    };
    const agent = { chat: vi.fn().mockResolvedValue(out) };
    const app = buildTestApp(agent);

    const res = await post(app, {
      messages: [{ role: "user", text: "やっとサボれる" }],
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { reply: string; action?: string };
    expect(json.reply).toBe("ここはサボっていいよ。");
    expect(json.action).toBe("progress_report");
  });

  it("文体サンプル（free_text honne）と呼び名を agent に渡す", async () => {
    const chat = vi.fn().mockResolvedValue({ reply: "ok" });
    const honneRepo = {
      findAllByUserId: vi.fn().mockResolvedValue([
        { type: "free_text", content: "了解です〜", taskId: "t", userId: MOCK_USER_ID },
        { type: "quick_reply", content: "truly_tired", taskId: "t", userId: MOCK_USER_ID },
      ]),
    };
    const userRepo = {
      findById: vi.fn().mockResolvedValue({ name: "たろ" }),
    };
    const app = buildTestApp({ chat }, honneRepo, userRepo);

    await post(app, {
      messages: [{ role: "user", text: "サボりたい" }],
      context: "次は19:30",
    });

    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        taskContext: "次は19:30",
        styleSamples: expect.stringContaining("了解です〜"),
        userName: "たろ",
      }),
    );
    // quick_reply は文体サンプルに含めない
    const arg = chat.mock.calls[0][0] as { styleSamples?: string };
    expect(arg.styleSamples).not.toContain("truly_tired");
  });

  it("バリデーション不正は 400", async () => {
    const app = buildTestApp({ chat: vi.fn() });
    const res = await post(app, { messages: [] });
    expect(res.status).toBe(400);
  });

  it("agent 失敗時は 503 CHAT_GENERATION_FAILED", async () => {
    const agent = { chat: vi.fn().mockRejectedValue(new Error("bedrock down")) };
    const app = buildTestApp(agent);
    const res = await post(app, {
      messages: [{ role: "user", text: "x" }],
    });
    expect(res.status).toBe(503);
    const json = (await res.json()) as { error?: { code?: string } };
    expect(json.error?.code).toBe("CHAT_GENERATION_FAILED");
  });

  it("honne/user 取得に失敗しても会話は続行する", async () => {
    const chat = vi.fn().mockResolvedValue({ reply: "ok" });
    const honneRepo = {
      findAllByUserId: vi.fn().mockRejectedValue(new Error("dynamo down")),
    };
    const userRepo = {
      findById: vi.fn().mockRejectedValue(new Error("dynamo down")),
    };
    const app = buildTestApp({ chat }, honneRepo, userRepo);

    const res = await post(app, {
      messages: [{ role: "user", text: "x" }],
    });
    expect(res.status).toBe(200);
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({ styleSamples: undefined, userName: undefined }),
    );
  });
});
