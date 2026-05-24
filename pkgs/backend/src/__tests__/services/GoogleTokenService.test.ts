/**
 * GoogleTokenService のテスト
 *
 * テスト内容:
 * - getValidAccessToken: in-memory キャッシュヒット・Secrets Manager からの取得・予防的リフレッシュ
 * - refreshAccessToken: 正常系・APIエラー・レスポンスバリデーション失敗
 * - buildSecretName: 静的メソッドの出力確認
 * - computeExpiresAt: 静的メソッドの出力確認
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleTokenService } from "../../services/GoogleTokenService.js";

// secrets.ts をモック（getGoogleToken / getCachedGoogleAccessToken / saveGoogleToken）
vi.mock("../../config/secrets.js", () => ({
  getCachedGoogleAccessToken: vi.fn(),
  getGoogleToken: vi.fn(),
  saveGoogleToken: vi.fn(),
}));

import {
  getCachedGoogleAccessToken,
  getGoogleToken,
  saveGoogleToken,
} from "../../config/secrets.js";

const MOCK_CACHED = getCachedGoogleAccessToken as ReturnType<typeof vi.fn>;
const MOCK_GET_TOKEN = getGoogleToken as ReturnType<typeof vi.fn>;
const MOCK_SAVE_TOKEN = saveGoogleToken as ReturnType<typeof vi.fn>;

const USER_ID = "user-token-test";
const SECRET_NAME = "saborou/google-token/user-token-test";
const CLIENT_ID = "google-client-id";
const CLIENT_SECRET = "google-client-secret";

// 有効期限が十分先のトークンデータ（5分バッファより長い）
function makeTokenData(offsetMs = 60 * 60 * 1000) {
  return {
    refreshToken: "refresh-token",
    accessToken: "fresh-access-token",
    expiresAt: new Date(Date.now() + offsetMs).toISOString(),
    scope: "gmail.readonly",
  };
}

describe("GoogleTokenService.buildSecretName", () => {
  it("正しいシークレット名を返す", () => {
    const name = GoogleTokenService.buildSecretName("user-abc");
    expect(name).toBe("saborou/google-token/user-abc");
  });
});

describe("GoogleTokenService.computeExpiresAt", () => {
  it("expires_in 秒後の ISO 文字列を返す", () => {
    const before = Date.now();
    const result = GoogleTokenService.computeExpiresAt(3600);
    const after = Date.now();

    const expiresAtMs = new Date(result).getTime();
    // 3600秒後前後の範囲内に収まる
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(expiresAtMs).toBeLessThanOrEqual(after + 3600 * 1000);
  });
});

describe("GoogleTokenService.getValidAccessToken — in-memory キャッシュヒット", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("in-memory キャッシュが有効な場合はそのまま返す（Secrets Manager 呼び出しなし）", async () => {
    // 5分バッファより十分余裕がある (30分先)
    MOCK_CACHED.mockReturnValue({
      accessToken: "cached-access-token",
      expiresAt: Date.now() + 30 * 60 * 1000,
      scope: "gmail.readonly",
    });

    const service = new GoogleTokenService();
    const token = await service.getValidAccessToken(
      USER_ID,
      SECRET_NAME,
      CLIENT_ID,
      CLIENT_SECRET,
    );

    expect(token).toBe("cached-access-token");
    expect(MOCK_GET_TOKEN).not.toHaveBeenCalled();
  });

  it("in-memory キャッシュが5分以内に期限切れなら Secrets Manager を確認する", async () => {
    // 3分後（5分バッファより短い）
    MOCK_CACHED.mockReturnValue({
      accessToken: "expiring-soon-token",
      expiresAt: Date.now() + 3 * 60 * 1000,
      scope: "gmail.readonly",
    });
    // Secrets Manager のトークンは十分有効
    MOCK_GET_TOKEN.mockResolvedValue(makeTokenData(60 * 60 * 1000));

    const service = new GoogleTokenService();
    const token = await service.getValidAccessToken(
      USER_ID,
      SECRET_NAME,
      CLIENT_ID,
      CLIENT_SECRET,
    );

    expect(MOCK_GET_TOKEN).toHaveBeenCalledOnce();
    expect(token).toBe("fresh-access-token");
  });

  it("in-memory キャッシュなし（null）の場合は Secrets Manager を確認する", async () => {
    MOCK_CACHED.mockReturnValue(null);
    MOCK_GET_TOKEN.mockResolvedValue(makeTokenData(60 * 60 * 1000));

    const service = new GoogleTokenService();
    const token = await service.getValidAccessToken(
      USER_ID,
      SECRET_NAME,
      CLIENT_ID,
      CLIENT_SECRET,
    );

    expect(MOCK_GET_TOKEN).toHaveBeenCalledOnce();
    expect(token).toBe("fresh-access-token");
  });
});

describe("GoogleTokenService.getValidAccessToken — Secrets Manager からのトークン管理", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MOCK_CACHED.mockReturnValue(null); // キャッシュなし
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Secrets Manager のトークンが有効な場合はリフレッシュせずに返す", async () => {
    MOCK_GET_TOKEN.mockResolvedValue(makeTokenData(60 * 60 * 1000)); // 1時間先

    const service = new GoogleTokenService();
    const token = await service.getValidAccessToken(
      USER_ID,
      SECRET_NAME,
      CLIENT_ID,
      CLIENT_SECRET,
    );

    expect(token).toBe("fresh-access-token");
    expect(MOCK_SAVE_TOKEN).not.toHaveBeenCalled();
  });

  it("Secrets Manager のトークンが5分以内に期限切れなら refreshAccessToken を呼ぶ", async () => {
    // 2分後に期限切れ（バッファ5分より短い）
    MOCK_GET_TOKEN.mockResolvedValue({
      ...makeTokenData(2 * 60 * 1000),
      refreshToken: "old-refresh-token",
    });

    // fetch モック: リフレッシュ成功
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "new-access-token",
          expires_in: 3600,
          scope: "gmail.readonly",
          token_type: "Bearer",
        }),
      }),
    );
    MOCK_SAVE_TOKEN.mockResolvedValue("arn:test");

    const service = new GoogleTokenService();
    const token = await service.getValidAccessToken(
      USER_ID,
      SECRET_NAME,
      CLIENT_ID,
      CLIENT_SECRET,
    );

    expect(token).toBe("new-access-token");
    expect(MOCK_SAVE_TOKEN).toHaveBeenCalledOnce();
  });
});

describe("GoogleTokenService.refreshAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MOCK_SAVE_TOKEN.mockResolvedValue("arn:test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常系: 新しいアクセストークンを返して Secrets Manager を更新する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "refreshed-token",
          expires_in: 3600,
          scope: "gmail.readonly",
          token_type: "Bearer",
        }),
      }),
    );

    const service = new GoogleTokenService();
    const token = await service.refreshAccessToken(
      USER_ID,
      SECRET_NAME,
      "old-refresh-token",
      CLIENT_ID,
      CLIENT_SECRET,
    );

    expect(token).toBe("refreshed-token");
    expect(MOCK_SAVE_TOKEN).toHaveBeenCalledOnce();

    // saveGoogleToken に渡された tokenData を検証
    const savedData = MOCK_SAVE_TOKEN.mock.calls[0][2];
    expect(savedData.accessToken).toBe("refreshed-token");
    expect(savedData.refreshToken).toBe("old-refresh-token"); // 元の refreshToken を維持
  });

  it("fetch が失敗 (ok=false) の場合はエラーをスローする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      }),
    );

    const service = new GoogleTokenService();
    await expect(
      service.refreshAccessToken(
        USER_ID,
        SECRET_NAME,
        "bad-refresh-token",
        CLIENT_ID,
        CLIENT_SECRET,
      ),
    ).rejects.toThrow("Google token refresh failed: 401");
  });

  it("fetch が成功してもレスポンス形式が不正な場合はエラーをスローする", async () => {
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

    const service = new GoogleTokenService();
    await expect(
      service.refreshAccessToken(
        USER_ID,
        SECRET_NAME,
        "refresh-token",
        CLIENT_ID,
        CLIENT_SECRET,
      ),
    ).rejects.toThrow("Google token refresh response validation failed");
  });

  it("fetch が network エラーの場合は例外を伝播する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network failure")),
    );

    const service = new GoogleTokenService();
    await expect(
      service.refreshAccessToken(
        USER_ID,
        SECRET_NAME,
        "refresh-token",
        CLIENT_ID,
        CLIENT_SECRET,
      ),
    ).rejects.toThrow("network failure");
  });

  it("refresh_token がレスポンスに含まれない場合でも元の refreshToken を維持する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          // refresh_token はリフレッシュレスポンスに含まれないのが標準
          access_token: "new-at",
          expires_in: 3600,
          scope: "gmail.readonly",
          token_type: "Bearer",
        }),
      }),
    );

    const service = new GoogleTokenService();
    await service.refreshAccessToken(
      USER_ID,
      SECRET_NAME,
      "keep-this-refresh-token",
      CLIENT_ID,
      CLIENT_SECRET,
    );

    const savedData = MOCK_SAVE_TOKEN.mock.calls[0][2];
    expect(savedData.refreshToken).toBe("keep-this-refresh-token");
  });
});
