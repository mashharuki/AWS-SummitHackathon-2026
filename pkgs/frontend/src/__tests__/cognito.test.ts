import {
  buildCognitoAuthUrl,
  buildSignOutUrl,
  clearTokens,
  exchangeCodeForTokens,
  getAccessToken,
  getRefreshToken,
  parseIdToken,
  refreshAccessToken,
  setAccessToken,
  setRefreshToken,
  validateOAuthState,
} from "@/lib/cognito";
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 環境変数モック
vi.stubEnv("VITE_COGNITO_DOMAIN", "https://test.auth.cognito.com");
vi.stubEnv("VITE_COGNITO_CLIENT_ID", "test-client-id");
vi.stubEnv("VITE_OAUTH_REDIRECT_URI", "http://localhost:5173/auth/callback");
vi.stubEnv("VITE_COGNITO_USER_POOL_ID", "ap-northeast-1_test");

describe("トークン管理 — setAccessToken / getAccessToken", () => {
  beforeEach(() => {
    clearTokens();
  });

  it("アクセストークンを設定・取得できる", () => {
    setAccessToken("test-token", 3600);
    expect(getAccessToken()).toBe("test-token");
  });

  it("clearTokensでアクセストークンが消える", () => {
    setAccessToken("test-token", 3600);
    clearTokens();
    expect(getAccessToken()).toBeNull();
  });

  it("期限切れトークン（expiresIn=0）はnullを返す", () => {
    // expiresIn=0 で即期限切れ（5分のバッファがあるので0秒でも期限切れ）
    setAccessToken("expired-token", 0);
    expect(getAccessToken()).toBeNull();
  });

  it("expiresInを指定しない場合はデフォルト3600秒で有効", () => {
    setAccessToken("default-expiry-token");
    expect(getAccessToken()).toBe("default-expiry-token");
  });

  it("トークンなし状態でgetAccessTokenはnullを返す", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("5分以内に期限切れになるトークンはnullを返す（バッファ検証）", () => {
    // 4分後に期限切れ = 240秒 < 5分(300秒)のバッファ内
    setAccessToken("near-expiry-token", 240);
    expect(getAccessToken()).toBeNull();
  });

  it("6分後に期限切れのトークンは有効", () => {
    // 6分 = 360秒 > 5分のバッファ
    setAccessToken("valid-near-expiry", 360);
    expect(getAccessToken()).toBe("valid-near-expiry");
  });
});

describe("リフレッシュトークン管理 — setRefreshToken / getRefreshToken", () => {
  beforeEach(() => {
    clearTokens();
    localStorage.clear();
  });

  it("リフレッシュトークンをlocalStorageに保存する", () => {
    setRefreshToken("refresh-token");
    expect(getRefreshToken()).toBe("refresh-token");
  });

  it("clearTokensでリフレッシュトークンが消える", () => {
    setRefreshToken("refresh-token");
    clearTokens();
    expect(getRefreshToken()).toBeNull();
  });

  it("メモリのリフレッシュトークンを優先する", () => {
    localStorage.setItem("saboru_rt", "storage-token");
    setRefreshToken("memory-token");
    expect(getRefreshToken()).toBe("memory-token");
  });

  it("メモリになければlocalStorageから取得する", () => {
    localStorage.setItem("saboru_rt", "from-storage");
    // メモリはcleared状態
    expect(getRefreshToken()).toBe("from-storage");
  });

  it("localStorageもメモリもない場合はnullを返す", () => {
    expect(getRefreshToken()).toBeNull();
  });
});

describe("OAuth CSRF防止 — buildCognitoAuthUrl / validateOAuthState", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("buildCognitoAuthUrlが正しいOAuthパラメータ構造を持つ", () => {
    // COGNITO_DOMAIN, CLIENT_ID はモジュールレベル定数のためvi.stubEnvの影響を受けない
    // URLの構造（OAuthパラメータの存在）を検証する
    const url = buildCognitoAuthUrl();
    expect(url).toContain("/oauth2/authorize");
    expect(url).toContain("response_type=code");
    expect(url).toContain("client_id=");
    expect(url).toContain("scope=openid+email+profile");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("state=");
  });

  it("buildCognitoAuthUrlがstateをsessionStorageに保存する", () => {
    buildCognitoAuthUrl();
    const state = sessionStorage.getItem("oauth_state");
    expect(state).toBeTruthy();
    expect(state).toContain("test-uuid-");
  });

  it("正しいstateで検証成功", () => {
    buildCognitoAuthUrl();
    const state = sessionStorage.getItem("oauth_state");
    expect(validateOAuthState(state!)).toBe(true);
  });

  it("不正なstateで検証失敗", () => {
    buildCognitoAuthUrl();
    expect(validateOAuthState("wrong-state")).toBe(false);
  });

  it("検証後にsessionStorageからstateが削除される", () => {
    buildCognitoAuthUrl();
    const state = sessionStorage.getItem("oauth_state");
    validateOAuthState(state!);
    expect(sessionStorage.getItem("oauth_state")).toBeNull();
  });

  it("stateがない状態でvalidateOAuthStateはfalseを返す", () => {
    // sessionStorage.clearされているため、expectedState=null
    expect(validateOAuthState("any-state")).toBe(false);
  });
});

describe("exchangeCodeForTokens — 認証コードとトークン交換", () => {
  // cognito.tsのCOGNITO_DOMAINはモジュールレベル定数なので
  // vi.stubEnvではなくMSWのワイルドカードパターンを使用してモックする
  it("正常系: コードをトークンに交換できる", async () => {
    server.use(
      http.post("*/oauth2/token", () => {
        return HttpResponse.json({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          id_token: "new-id-token",
          expires_in: 3600,
        });
      }),
    );

    const result = await exchangeCodeForTokens("auth-code-123");
    expect(result.accessToken).toBe("new-access-token");
    expect(result.refreshToken).toBe("new-refresh-token");
    expect(result.idToken).toBe("new-id-token");
    expect(result.expiresIn).toBe(3600);
  });

  it("異常系: トークン交換失敗でErrorをスロー", async () => {
    server.use(
      http.post("*/oauth2/token", () => {
        return new HttpResponse(null, { status: 400 });
      }),
    );

    await expect(exchangeCodeForTokens("invalid-code")).rejects.toThrow(
      "Token exchange failed: 400",
    );
  });

  it("異常系: 401でもErrorをスロー", async () => {
    server.use(
      http.post("*/oauth2/token", () => {
        return new HttpResponse(null, { status: 401 });
      }),
    );

    await expect(exchangeCodeForTokens("expired-code")).rejects.toThrow(
      "Token exchange failed: 401",
    );
  });
});

describe("refreshAccessToken — リフレッシュトークンでアクセストークンを更新", () => {
  beforeEach(() => {
    clearTokens();
    localStorage.clear();
  });

  it("正常系: リフレッシュ成功でnewアクセストークンを返す", async () => {
    setRefreshToken("valid-refresh-token");

    server.use(
      http.post("*/oauth2/token", () => {
        return HttpResponse.json({
          access_token: "refreshed-access-token",
          expires_in: 3600,
        });
      }),
    );

    const token = await refreshAccessToken();
    expect(token).toBe("refreshed-access-token");
    // メモリに新トークンが設定されているか
    expect(getAccessToken()).toBe("refreshed-access-token");
  });

  it("異常系: リフレッシュトークンなしでnullを返す", async () => {
    // リフレッシュトークンはない
    const token = await refreshAccessToken();
    expect(token).toBeNull();
  });

  it("異常系: APIエラー時はclearTokensしてnullを返す", async () => {
    setRefreshToken("expired-refresh-token");

    server.use(
      http.post("*/oauth2/token", () => {
        return new HttpResponse(null, { status: 400 });
      }),
    );

    const token = await refreshAccessToken();
    expect(token).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("異常系: ネットワークエラー時はclearTokensしてnullを返す", async () => {
    setRefreshToken("valid-refresh-token");

    server.use(
      http.post("*/oauth2/token", () => {
        return HttpResponse.error();
      }),
    );

    const token = await refreshAccessToken();
    expect(token).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});

describe("parseIdToken — IDトークンのデコード", () => {
  // ASCII文字のみを含むpayloadでJWTを生成するヘルパー
  function createMockIdToken(payload: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    // encodeURIComponentで非ASCII文字をエスケープしてからbtoaに渡す
    const jsonStr = JSON.stringify(payload);
    const utf8Encoded = unescape(encodeURIComponent(jsonStr));
    const body = btoa(utf8Encoded)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    const signature = "mock-signature";
    return `${header}.${body}.${signature}`;
  }

  it("正常系: sub, email, nameを取得できる", () => {
    const token = createMockIdToken({
      sub: "user-123",
      email: "user@example.com",
      name: "yamada",
    });
    const result = parseIdToken(token);
    expect(result.sub).toBe("user-123");
    expect(result.email).toBe("user@example.com");
    expect(result.name).toBe("yamada");
  });

  it("nameがない場合はcognito:usernameを使用する", () => {
    const token = createMockIdToken({
      sub: "user-456",
      email: "user@example.com",
      "cognito:username": "cognito_user",
    });
    const result = parseIdToken(token);
    expect(result.name).toBe("cognito_user");
  });

  it("nameもcognito:usernameもない場合はemailをnameとして使用する", () => {
    const token = createMockIdToken({
      sub: "user-789",
      email: "fallback@example.com",
    });
    const result = parseIdToken(token);
    expect(result.name).toBe("fallback@example.com");
  });

  it("異常系: 不正なIDトークンでErrorをスロー（1セグメントのみ）", () => {
    // payloadが存在しないトークン（split(".")で配列の[1]がundefined）
    expect(() => parseIdToken("invalid-token")).toThrow("Invalid ID token");
  });

  it("異常系: ピリオドなしトークンでErrorをスロー", () => {
    expect(() => parseIdToken("onlyone")).toThrow("Invalid ID token");
  });
});

describe("buildSignOutUrl — サインアウトURL生成", () => {
  it("正しいサインアウトURLを構築する（logout_uriとclient_idが含まれる）", () => {
    // COGNITO_DOMAINはモジュールレベル定数のためvi.stubEnvが効かないが、
    // URLのパス構造とパラメータの存在確認はできる
    const url = buildSignOutUrl();
    expect(url).toContain("/logout");
    expect(url).toContain("client_id=");
    expect(url).toContain("logout_uri=");
    // URLエンコードされた/loginを含む
    expect(url).toContain("%2Flogin");
  });
});

describe("clearTokens — 全トークンのクリア", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("アクセストークン・リフレッシュトークン・有効期限をすべてクリアする", () => {
    setAccessToken("access", 3600);
    setRefreshToken("refresh");
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("localStorageのsaboru_rtも削除される", () => {
    localStorage.setItem("saboru_rt", "stored-refresh");
    clearTokens();
    expect(localStorage.getItem("saboru_rt")).toBeNull();
  });
});
