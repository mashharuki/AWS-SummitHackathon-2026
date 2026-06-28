/**
 * cognitoAuth.ts ユニットテスト
 *
 * 純粋ロジック（PKCE 生成・トークン検証・JWT パース・ストレージ round-trip・getValidToken）を
 * Vitest でテストする。chrome.storage.local は setup.ts のグローバルモックを使い、
 * 各テストで vi.fn() で上書きする。
 * env 変数（VITE_COGNITO_DOMAIN / VITE_COGNITO_CLIENT_ID）は vi.stubEnv で注入する。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- env スタブ（モジュールインポート前に実施する必要があるため hoisting） ---
vi.stubEnv(
  "VITE_COGNITO_DOMAIN",
  "https://saborou-auth-test.auth.ap-northeast-1.amazoncognito.com",
);
vi.stubEnv("VITE_COGNITO_CLIENT_ID", "test-client-id-12345678");
vi.stubEnv(
  "VITE_EXTENSION_REDIRECT_URI",
  "https://test-extension-id.chromiumapp.org/",
);

// cognitoAuth.ts は import.meta.env.VITE_* を参照するが、
// VITE_COGNITO_DOMAIN / VITE_COGNITO_CLIENT_ID が未定義時に throw するため
// stubEnv の後でインポートする。
import {
  buildAuthUrl,
  clearStoredTokens,
  generateCodeChallenge,
  generateCodeVerifier,
  getRedirectUri,
  getValidToken,
  isTokenValid,
  loadTokens,
  parseIdToken,
  refreshTokens,
  saveTokens,
} from "./cognitoAuth";

// ---------------------------------------------------------------------------
// ヘルパー: chrome.storage.local のモック切り替え
// ---------------------------------------------------------------------------

function mockStorage(overrides: {
  get?: ReturnType<typeof vi.fn>;
  set?: ReturnType<typeof vi.fn>;
  remove?: ReturnType<typeof vi.fn>;
}) {
  const mock = {
    get: overrides.get ?? vi.fn().mockResolvedValue({}),
    set: overrides.set ?? vi.fn().mockResolvedValue(undefined),
    remove: overrides.remove ?? vi.fn().mockResolvedValue(undefined),
  };
  // setup.ts で configurable: true で定義済みのためそのまま代入可能
  (global.chrome as unknown as Record<string, unknown>).storage = {
    local: mock,
  };
  return mock;
}

afterEach(() => {
  vi.restoreAllMocks();
  // デフォルトモックに戻す
  mockStorage({});
});

// ---------------------------------------------------------------------------
// generateCodeVerifier
// ---------------------------------------------------------------------------

describe("generateCodeVerifier", () => {
  it("URL-safe base64 文字のみ（A-Za-z0-9-_）で構成される", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("43 文字前後（32バイト → base64 43文字）", () => {
    const verifier = generateCodeVerifier();
    // 32バイト → パディングなし base64 = ceil(32 * 4/3) = 43 文字
    expect(verifier.length).toBeGreaterThanOrEqual(42);
    expect(verifier.length).toBeLessThanOrEqual(44);
  });

  it("呼び出しごとに異なる値（ランダム性）", () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(v1).not.toBe(v2);
  });
});

// ---------------------------------------------------------------------------
// generateCodeChallenge
// ---------------------------------------------------------------------------

describe("generateCodeChallenge", () => {
  it("同じ verifier から同じ challenge を生成（決定論的）", async () => {
    const verifier = "test-verifier-12345678901234567890";
    const c1 = await generateCodeChallenge(verifier);
    const c2 = await generateCodeChallenge(verifier);
    expect(c1).toBe(c2);
  });

  it("URL-safe base64 文字のみ（パディングなし）", async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).not.toContain("=");
  });

  it("異なる verifier からは異なる challenge", async () => {
    const c1 = await generateCodeChallenge("verifier-aaaaaa");
    const c2 = await generateCodeChallenge("verifier-bbbbbb");
    expect(c1).not.toBe(c2);
  });

  it("SHA-256 は 32 バイト → base64 43 文字", async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge.length).toBeGreaterThanOrEqual(42);
    expect(challenge.length).toBeLessThanOrEqual(44);
  });
});

// ---------------------------------------------------------------------------
// isTokenValid
// ---------------------------------------------------------------------------

describe("isTokenValid", () => {
  it("有効期限まで 6 分以上: true", () => {
    const expiresAt = Date.now() + 6 * 60 * 1000;
    expect(isTokenValid(expiresAt)).toBe(true);
  });

  it("有効期限まで 5 分以内（境界）: false", () => {
    const expiresAt = Date.now() + 4 * 60 * 1000;
    expect(isTokenValid(expiresAt)).toBe(false);
  });

  it("有効期限が過去: false", () => {
    const expiresAt = Date.now() - 1000;
    expect(isTokenValid(expiresAt)).toBe(false);
  });

  it("ちょうど 5 分前: false（境界値）", () => {
    // Date.now() + 5分 - 1ms は 5分マージン内なので false
    const expiresAt = Date.now() + 5 * 60 * 1000 - 1;
    expect(isTokenValid(expiresAt)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseIdToken
// ---------------------------------------------------------------------------

/** JWT payload を base64url エンコードして簡易 JWT トークンを作成（ASCII 文字のみ使用）
 *
 * parseIdToken は atob でデコードするため、payload の文字列値は ASCII のみにする。
 * 非ASCII文字が必要な場合は encodeURIComponent でエスケープした値を payload に渡すこと。
 */
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `${header}.${body}.fake-signature`;
}

describe("parseIdToken", () => {
  it("name / email / sub を正しく抽出する", () => {
    // parseIdToken は atob でデコードするため ASCII 文字のみ使用する
    const jwt = makeJwt({
      sub: "user-123",
      email: "test@example.com",
      name: "TestUser",
    });
    const result = parseIdToken(jwt);
    expect(result.sub).toBe("user-123");
    expect(result.email).toBe("test@example.com");
    expect(result.name).toBe("TestUser");
  });

  it("name がない場合は cognito:username にフォールバック", () => {
    const jwt = makeJwt({
      sub: "u1",
      email: "a@b.com",
      "cognito:username": "cog-user",
    });
    const result = parseIdToken(jwt);
    expect(result.name).toBe("cog-user");
  });

  it("name も cognito:username もない場合は email にフォールバック", () => {
    const jwt = makeJwt({ sub: "u1", email: "fallback@example.com" });
    const result = parseIdToken(jwt);
    expect(result.name).toBe("fallback@example.com");
  });

  it("不正なフォーマット（ドット 2 個未満）で throw", () => {
    expect(() => parseIdToken("not-a-jwt")).toThrow();
  });

  it("payload が空のセグメント（parts[1] が空文字）で throw", () => {
    expect(() => parseIdToken("header..signature")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// saveTokens / loadTokens / clearStoredTokens
// ---------------------------------------------------------------------------

describe("saveTokens / loadTokens / clearStoredTokens", () => {
  it("saveTokens が chrome.storage.local.set を呼ぶ", async () => {
    const mock = mockStorage({});
    await saveTokens({
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 3600000,
    });
    expect(mock.set).toHaveBeenCalledOnce();
    const arg = (mock.set as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg).toHaveProperty("saboru_ext_auth");
    expect(arg.saboru_ext_auth.idToken).toBe("id-token");
  });

  it("loadTokens: ストレージにデータがない場合 null を返す", async () => {
    mockStorage({ get: vi.fn().mockResolvedValue({}) });
    const result = await loadTokens();
    expect(result).toBeNull();
  });

  it("saveTokens → loadTokens で round-trip", async () => {
    const storedData = {
      idToken: "id-tok",
      accessToken: "acc-tok",
      refreshToken: "ref-tok",
      expiresAt: 99999,
    };
    // set をキャプチャして get で同じデータを返す
    let captured: unknown = null;
    const setFn = vi.fn().mockImplementation((data: unknown) => {
      captured = data;
      return Promise.resolve();
    });
    const getFn = vi
      .fn()
      .mockImplementation(() => Promise.resolve(captured ?? {}));
    mockStorage({ set: setFn, get: getFn });

    await saveTokens(storedData);
    const loaded = await loadTokens();
    expect(loaded).toEqual(storedData);
  });

  it("clearStoredTokens が chrome.storage.local.remove を呼ぶ", async () => {
    const mock = mockStorage({});
    await clearStoredTokens();
    expect(mock.remove).toHaveBeenCalledOnce();
    expect(mock.remove).toHaveBeenCalledWith("saboru_ext_auth");
  });
});

// ---------------------------------------------------------------------------
// getValidToken
// ---------------------------------------------------------------------------

describe("getValidToken", () => {
  it("ストレージが空 → null を返す", async () => {
    mockStorage({ get: vi.fn().mockResolvedValue({}) });
    const result = await getValidToken();
    expect(result).toBeNull();
  });

  it("有効期限内のトークン → idToken を返す", async () => {
    const tokens = {
      idToken: "valid-id-token",
      accessToken: "acc",
      refreshToken: "ref",
      expiresAt: Date.now() + 10 * 60 * 1000, // 10分後
    };
    mockStorage({
      get: vi.fn().mockResolvedValue({ saboru_ext_auth: tokens }),
    });
    const result = await getValidToken();
    expect(result).toBe("valid-id-token");
  });

  it("期限切れ → refresh 成功 → 新しい idToken を返す", async () => {
    const expiredTokens = {
      idToken: "old-id-token",
      accessToken: "old-acc",
      refreshToken: "valid-refresh-token",
      expiresAt: Date.now() - 1000, // 期限切れ
    };
    let storedData: unknown = { saboru_ext_auth: expiredTokens };
    const getFn = vi.fn().mockImplementation(() => Promise.resolve(storedData));
    const setFn = vi.fn().mockImplementation((data: unknown) => {
      storedData = data;
      return Promise.resolve();
    });
    mockStorage({ get: getFn, set: setFn });

    // fetch をモック: refresh_token エンドポイントが新しいトークンを返す
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access-token",
        id_token: "new-id-token",
        expires_in: 3600,
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await getValidToken();
    expect(result).toBe("new-id-token");
    expect(setFn).toHaveBeenCalled(); // ストレージが更新された

    vi.unstubAllGlobals();
  });

  it("期限切れ → refresh 失敗 → null + ストレージをクリア", async () => {
    const expiredTokens = {
      idToken: "old-id-token",
      accessToken: "old-acc",
      refreshToken: "invalid-refresh-token",
      expiresAt: Date.now() - 1000,
    };
    mockStorage({
      get: vi.fn().mockResolvedValue({ saboru_ext_auth: expiredTokens }),
    });

    // fetch をモック: 失敗レスポンス
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", mockFetch);

    const removeFn = vi.fn().mockResolvedValue(undefined);
    mockStorage({
      get: vi.fn().mockResolvedValue({ saboru_ext_auth: expiredTokens }),
      remove: removeFn,
    });

    const result = await getValidToken();
    expect(result).toBeNull();
    expect(removeFn).toHaveBeenCalledWith("saboru_ext_auth");

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// buildAuthUrl
// ---------------------------------------------------------------------------

describe("buildAuthUrl", () => {
  it("response_type=code を含む URL を生成", async () => {
    const { url } = await buildAuthUrl(
      "https://test-extension-id.chromiumapp.org/",
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("response_type")).toBe("code");
  });

  it("code_challenge_method=S256 を含む", async () => {
    const { url } = await buildAuthUrl(
      "https://test-extension-id.chromiumapp.org/",
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("scope=openid email profile を含む", async () => {
    const { url } = await buildAuthUrl(
      "https://test-extension-id.chromiumapp.org/",
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("scope")).toBe("openid email profile");
  });

  it("code_challenge が存在する", async () => {
    const { url } = await buildAuthUrl(
      "https://test-extension-id.chromiumapp.org/",
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("code_challenge")).toBeTruthy();
  });

  it("codeVerifier と state も返す", async () => {
    const result = await buildAuthUrl(
      "https://test-extension-id.chromiumapp.org/",
    );
    expect(result.codeVerifier).toBeTruthy();
    expect(result.state).toBeTruthy();
  });

  it("Cognito ドメインを起点とした URL", async () => {
    const { url } = await buildAuthUrl(
      "https://test-extension-id.chromiumapp.org/",
    );
    expect(url).toContain(
      "saborou-auth-test.auth.ap-northeast-1.amazoncognito.com",
    );
    expect(url).toContain("/oauth2/authorize");
  });
});

// ---------------------------------------------------------------------------
// getRedirectUri
// ---------------------------------------------------------------------------

describe("getRedirectUri", () => {
  it("VITE_EXTENSION_REDIRECT_URI が設定されている場合はそれを返す", () => {
    // setup 済み: VITE_EXTENSION_REDIRECT_URI = "https://test-extension-id.chromiumapp.org/"
    const uri = getRedirectUri();
    expect(uri).toBe("https://test-extension-id.chromiumapp.org/");
  });
});

// ---------------------------------------------------------------------------
// refreshTokens
// ---------------------------------------------------------------------------

describe("refreshTokens", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetch 成功: accessToken / idToken / expiresIn を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "new-acc",
          id_token: "new-id",
          expires_in: 3600,
        }),
      }),
    );

    const result = await refreshTokens("valid-refresh-token");
    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe("new-acc");
    expect(result?.idToken).toBe("new-id");
    expect(result?.expiresIn).toBe(3600);
  });

  it("fetch 失敗（ok: false）: null を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await refreshTokens("bad-token");
    expect(result).toBeNull();
  });

  it("fetch で例外: null を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );
    const result = await refreshTokens("any-token");
    expect(result).toBeNull();
  });
});
