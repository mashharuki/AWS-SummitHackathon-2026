/**
 * Google OAuth ルートのテスト
 *
 * GET  /auth/google          — 認可URL生成・state署名・認証なしで401
 * GET  /auth/google/callback — code交換・state検証・各エラーケース・成功時リダイレクト
 * DELETE /auth/google        — Google連携解除
 */

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import type { DynamoServiceConnectionRepository } from "../../repositories/DynamoServiceConnectionRepository.js";
import { createGoogleAuthRoute } from "../../routes/google-auth.js";
import type { AppEnv } from "../../types.js";

// env モック: Google 関連変数を含む
vi.mock("../../config/env.js", () => ({
  env: {
    COGNITO_USER_POOL_ID: "ap-northeast-1_test",
    COGNITO_CLIENT_ID: "client-id-test",
    DYNAMODB_TABLE_USERS: "users-test",
    DYNAMODB_TABLE_CONNECTIONS: "conns-test",
    DYNAMODB_TABLE_TASK_CANDIDATES: "cands-test",
    DYNAMODB_TABLE_TASKS: "tasks-test",
    DYNAMODB_TABLE_PROPOSALS: "proposals-test",
    DYNAMODB_TABLE_HONNE_DATA: "honne-test",
    DYNAMODB_TABLE_PERSONAS: "personas-test",
    SLACK_SIGNING_SECRET_ARN: "arn:test:signing",
    SLACK_CLIENT_SECRET_ARN: "arn:test:client",
    OAUTH_STATE_SECRET: "test-oauth-state-secret-32chars!!",
    EVENT_BUS_NAME: "test-bus",
    GOOGLE_CLIENT_SECRET_ARN: "arn:test:google:client",
    GOOGLE_CLIENT_ID: "google-client-id-test",
    DYNAMODB_TABLE_GOOGLE_CALENDAR_CACHE: "google-calendar-cache-test",
  },
}));

// secrets.ts をモック
vi.mock("../../config/secrets.js", () => ({
  getGoogleClientSecret: vi.fn(),
  saveGoogleToken: vi.fn(),
  getGoogleToken: vi.fn(),
  getCachedGoogleAccessToken: vi.fn(),
  getSlackSigningSecret: vi.fn(),
  getSlackClientSecret: vi.fn(),
  _resetSecretsCache: vi.fn(),
}));

// @aws-sdk/client-secrets-manager をモック（DELETE /auth/google でシークレット削除に使用）
const { mockSmSend } = vi.hoisted(() => ({ mockSmSend: vi.fn() }));
vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = mockSmSend;
  },
  DeleteSecretCommand: class {
    constructor(public input: unknown) {}
  },
}));

import {
  getGoogleClientSecret,
  saveGoogleToken,
} from "../../config/secrets.js";

const MOCK_GET_SECRET = getGoogleClientSecret as ReturnType<typeof vi.fn>;
const MOCK_SAVE_TOKEN = saveGoogleToken as ReturnType<typeof vi.fn>;

const MOCK_USER_ID = "user-google-auth-test";

function buildTestApp(
  connRepo: Partial<DynamoServiceConnectionRepository>,
  injectUserId = true,
) {
  const app = new Hono<AppEnv>();
  if (injectUserId) {
    app.use("*", async (c, next) => {
      (c as unknown as { env: unknown }).env = {
        requestContext: {
          authorizer: { jwt: { claims: { sub: MOCK_USER_ID } } },
        },
      };
      await next();
    });
  }
  app.route(
    "/auth",
    createGoogleAuthRoute(connRepo as DynamoServiceConnectionRepository),
  );
  app.onError(errorHandler);
  return app;
}

// 正しい state を生成するユーティリティ
function buildValidState(userId = MOCK_USER_ID): string {
  const { encodeState } = require("../../utils/oauthState.js");
  return encodeState(userId, "test-oauth-state-secret-32chars!!");
}

describe("GET /auth/google", () => {
  it("認証済みユーザーに Google 認可 URL を JSON で返す", async () => {
    const app = buildTestApp({});

    const res = await app.request("/auth/google");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    expect(body.url).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(body.url).toContain("redirect_uri=");
    expect(body.url).toContain("state=");
    expect(body.url).toContain("access_type=offline");
    expect(body.url).toContain("prompt=consent");
    expect(body.url).toContain("gmail.readonly");
    expect(body.url).toContain("calendar.readonly");
  });

  it("JWT がない場合は 401 を返す", async () => {
    const app = buildTestApp({}, false); // userId を注入しない

    const res = await app.request("/auth/google");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("GET /auth/google/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("error パラメーターが存在する場合（OAuth denied）はフロントエンドにリダイレクトする", async () => {
    const app = buildTestApp({});

    const res = await app.request("/auth/google/callback?error=access_denied");
    // Hono デフォルトリダイレクト: 302
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("google=error");
  });

  it("code と state が両方ない場合は 400 INVALID_CALLBACK を返す", async () => {
    const app = buildTestApp({});

    const res = await app.request("/auth/google/callback");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CALLBACK");
  });

  it("code があって state がない場合は 400 INVALID_CALLBACK を返す", async () => {
    const app = buildTestApp({});

    const res = await app.request("/auth/google/callback?code=auth-code");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CALLBACK");
  });

  it("state が改ざんされている場合は 400 INVALID_STATE を返す", async () => {
    const app = buildTestApp({});

    // 正しい形式だが MAC が不正な state
    const payload = JSON.stringify({ userId: MOCK_USER_ID, nonce: "n-1" });
    const state = Buffer.from(
      JSON.stringify({ payload, mac: "a".repeat(64) }),
    ).toString("base64url");

    const res = await app.request(
      `/auth/google/callback?code=some-code&state=${state}`,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_STATE");
  });

  it("state が base64 デコードできない場合は 400 INVALID_STATE を返す", async () => {
    const app = buildTestApp({});

    const res = await app.request(
      "/auth/google/callback?code=some-code&state=!!!invalid!!!",
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_STATE");
  });

  it("Google トークン交換 API がエラーを返す場合は 500 TOKEN_EXCHANGE_FAILED を返す", async () => {
    // 正しい state を生成
    const { encodeState } = await import("../../utils/oauthState.js");
    const state = encodeState(
      MOCK_USER_ID,
      "test-oauth-state-secret-32chars!!",
    );

    MOCK_GET_SECRET.mockResolvedValue(
      JSON.stringify({
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      }),
    );

    // トークン交換失敗
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
      }),
    );

    const app = buildTestApp({});
    const res = await app.request(
      `/auth/google/callback?code=bad-code&state=${state}`,
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("TOKEN_EXCHANGE_FAILED");
  });

  it("トークンレスポンスが不正な JSON 形式の場合は 500 TOKEN_EXCHANGE_FAILED を返す", async () => {
    const { encodeState } = await import("../../utils/oauthState.js");
    const state = encodeState(
      MOCK_USER_ID,
      "test-oauth-state-secret-32chars!!",
    );

    MOCK_GET_SECRET.mockResolvedValue(
      JSON.stringify({
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          // access_token がない不正なレスポンス
          expires_in: 3600,
          token_type: "Bearer",
        }),
      }),
    );

    const app = buildTestApp({});
    const res = await app.request(
      `/auth/google/callback?code=bad-code&state=${state}`,
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("TOKEN_EXCHANGE_FAILED");
  });

  it("トークンレスポンスに refresh_token がない場合は 500 TOKEN_EXCHANGE_FAILED を返す", async () => {
    const { encodeState } = await import("../../utils/oauthState.js");
    const state = encodeState(
      MOCK_USER_ID,
      "test-oauth-state-secret-32chars!!",
    );

    MOCK_GET_SECRET.mockResolvedValue(
      JSON.stringify({
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "at",
          expires_in: 3600,
          // refresh_token なし
          scope: "gmail.readonly",
          token_type: "Bearer",
        }),
      }),
    );

    const app = buildTestApp({});
    const res = await app.request(
      `/auth/google/callback?code=bad-code&state=${state}`,
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("TOKEN_EXCHANGE_FAILED");
  });

  it("正常系: トークン交換・保存成功後フロントエンドにリダイレクトする", async () => {
    const { encodeState } = await import("../../utils/oauthState.js");
    const state = encodeState(
      MOCK_USER_ID,
      "test-oauth-state-secret-32chars!!",
    );

    MOCK_GET_SECRET.mockResolvedValue(
      JSON.stringify({
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "access-token-ok",
          expires_in: 3600,
          refresh_token: "refresh-token-ok",
          scope: "gmail.readonly",
          token_type: "Bearer",
        }),
      }),
    );

    MOCK_SAVE_TOKEN.mockResolvedValue("arn:aws:secretsmanager:test:google");

    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      saveForUser: vi.fn().mockResolvedValue({}),
    };

    const app = buildTestApp(connRepo);
    const res = await app.request(
      `/auth/google/callback?code=valid-code&state=${state}`,
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("google=connected");
    expect(MOCK_SAVE_TOKEN).toHaveBeenCalledOnce();
    expect(connRepo.saveForUser).toHaveBeenCalledOnce();
    // saveForUser に渡されたデータを検証
    const saveArgs = (connRepo.saveForUser as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(saveArgs[0]).toBe(MOCK_USER_ID);
    expect(saveArgs[1].service).toBe("google");
    expect(saveArgs[1].status).toBe("connected");
  });
});

describe("DELETE /auth/google", () => {
  beforeEach(() => {
    mockSmSend.mockReset();
  });

  it("連携解除を呼び出して Secrets Manager のシークレットも削除し 200 success: true を返す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const app = buildTestApp(connRepo);
    // DeleteSecretCommand が成功する
    mockSmSend.mockResolvedValue({});

    const res = await app.request("/auth/google", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
    expect(connRepo.disconnect).toHaveBeenCalledWith(MOCK_USER_ID, "google");
    expect(mockSmSend).toHaveBeenCalledOnce();
  });

  it("シークレットが存在しない（ResourceNotFoundException）場合でも 200 を返す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const app = buildTestApp(connRepo);
    // シークレット削除が ResourceNotFoundException を返す（連携前に解除した場合など）
    const notFoundErr = Object.assign(new Error("Secret not found"), {
      name: "ResourceNotFoundException",
    });
    mockSmSend.mockRejectedValue(notFoundErr);

    const res = await app.request("/auth/google", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("シークレット削除で予期しないエラーが発生した場合は 500 を返す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const app = buildTestApp(connRepo);
    // ResourceNotFoundException 以外のエラー（例: AccessDeniedException）
    const accessDeniedErr = Object.assign(new Error("Access Denied"), {
      name: "AccessDeniedException",
    });
    mockSmSend.mockRejectedValue(accessDeniedErr);

    const res = await app.request("/auth/google", { method: "DELETE" });
    expect(res.status).toBe(500);
  });

  it("JWT がない場合は 401 を返す", async () => {
    const app = buildTestApp({}, false);

    const res = await app.request("/auth/google", { method: "DELETE" });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
