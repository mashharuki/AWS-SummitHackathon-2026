/**
 * 認証ミドルウェアのテスト
 *
 * テスト内容:
 * - JWT クレームから userId が抽出され Hono 変数として設定されること
 * - クレームがない場合に 401 が返されること
 */

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { authMiddleware } from "../../middleware/auth.js";
import { errorHandler } from "../../middleware/error-handler.js";
import type { AppEnv } from "../../types.js";

function buildApp(injectClaims?: { sub?: string }) {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    // c.env 経由で Lambda イベント注入をシミュレート
    if (injectClaims !== undefined) {
      (c as unknown as { env: unknown }).env = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: injectClaims,
            },
          },
        },
      };
    }
    // injectClaims が undefined の場合、c.env はそのまま (requestContext なし)
    await next();
  });

  app.use("*", authMiddleware);

  app.get("/test", (c) => {
    const userId = c.get("userId");
    return c.json({ userId });
  });

  // スローされた AppError を適切な HTTP レスポンスに変換するためエラーハンドラーを登録
  app.onError(errorHandler);

  return app;
}

describe("authMiddleware", () => {
  it("sets userId from JWT claims sub", async () => {
    const app = buildApp({ sub: "user-abc" });
    const res = await app.request("/test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("user-abc");
  });

  it("returns 401 when sub is missing", async () => {
    const app = buildApp({ sub: undefined });
    const res = await app.request("/test");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when env has no requestContext", async () => {
    const app = buildApp(undefined);
    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });

  it("returns 401 when claims object is empty", async () => {
    const app = buildApp({});
    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });
});
