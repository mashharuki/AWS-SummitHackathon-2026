/**
 * POST /api/vision/analyze-screen のテスト（余白タブ 画面判定）
 *
 * ScreenAnalysisAgent を Partial / vi.fn でモックし、base64 デコードと
 * 判定結果の返却、エラー時 503 を検証する。
 */

import type { ScreenAnalysisAgent } from "@saboru/agent";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import { createVisionRoute } from "../../routes/vision.js";
import type { AppEnv } from "../../types.js";

const MOCK_USER_ID = "user-vision-test";
// "test" を base64 化したもの
const SAMPLE_BASE64 = Buffer.from("test").toString("base64");

function buildTestApp(agent: Partial<ScreenAnalysisAgent>) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    (c as unknown as { env: unknown }).env = {
      requestContext: {
        authorizer: { jwt: { claims: { sub: MOCK_USER_ID } } },
      },
    };
    await next();
  });
  app.route("/vision", createVisionRoute(agent as ScreenAnalysisAgent));
  app.onError(errorHandler);
  return app;
}

function post(app: Hono<AppEnv>, body: unknown) {
  return app.request("/vision/analyze-screen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/vision/analyze-screen", () => {
  it("判定結果（matched / observedActivity / confidence）を返す", async () => {
    const analyzeScreenshot = vi.fn().mockResolvedValue({
      matched: true,
      observedActivity: "議事録を編集中",
      confidence: 0.88,
    });
    const app = buildTestApp({ analyzeScreenshot });

    const res = await post(app, {
      imageBase64: SAMPLE_BASE64,
      format: "jpeg",
      expectedTitle: "議事録をまとめる",
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { matched: boolean; confidence: number };
    expect(json.matched).toBe(true);
    expect(json.confidence).toBeCloseTo(0.88);
    // bytes にデコードして渡している
    const arg = analyzeScreenshot.mock.calls[0][0] as {
      imageBytes: Uint8Array;
      expectedTitle: string;
    };
    expect(arg.imageBytes).toBeInstanceOf(Uint8Array);
    expect(arg.expectedTitle).toBe("議事録をまとめる");
  });

  it("data URL プレフィックス付きでもデコードできる", async () => {
    const analyzeScreenshot = vi.fn().mockResolvedValue({
      matched: false,
      observedActivity: "動画視聴中",
      confidence: 0.7,
    });
    const app = buildTestApp({ analyzeScreenshot });

    const res = await post(app, {
      imageBase64: `data:image/jpeg;base64,${SAMPLE_BASE64}`,
      expectedTitle: "議事録",
    });
    expect(res.status).toBe(200);
  });

  it("バリデーション不正は 400", async () => {
    const app = buildTestApp({ analyzeScreenshot: vi.fn() });
    const res = await post(app, { imageBase64: "", expectedTitle: "" });
    expect(res.status).toBe(400);
  });

  it("agent 失敗時は 503 VISION_ANALYSIS_FAILED", async () => {
    const analyzeScreenshot = vi
      .fn()
      .mockRejectedValue(new Error("bedrock down"));
    const app = buildTestApp({ analyzeScreenshot });

    const res = await post(app, {
      imageBase64: SAMPLE_BASE64,
      expectedTitle: "議事録",
    });
    expect(res.status).toBe(503);
    const json = (await res.json()) as { error?: { code?: string } };
    expect(json.error?.code).toBe("VISION_ANALYSIS_FAILED");
  });
});
