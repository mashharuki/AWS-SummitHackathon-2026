/**
 * Chrome Extension Cognito PKCE Authentication
 *
 * v1 Web アプリ（pkgs/frontend/src/lib/cognito.ts）と同一 Cognito User Pool / Client を共有。
 * Chrome 拡張では localStorage / sessionStorage が使えないため、
 * chrome.storage.local にトークンを永続化する。
 *
 * フロー:
 *   1. PKCE (code_verifier / code_challenge S256) を生成
 *   2. chrome.identity.launchWebAuthFlow で Cognito Hosted UI を開く
 *   3. リダイレクト URL (https://<extension-id>.chromiumapp.org/) に含まれる
 *      認可コードを取得
 *   4. Cognito /oauth2/token エンドポイントで JWT と交換
 *   5. JWT を chrome.storage.local に保存
 *
 * 実運用で extension ID を確定させる手順:
 *   - chrome://extensions で拡張をインストール後、表示される Extension ID をコピー
 *   - Cognito App Client の callbackUrls に
 *     `https://<extension-id>.chromiumapp.org/` を追加
 *   - CDK: cognito-stack.ts の extensionCallbackUrls に追加して再デプロイ
 *
 * ENV VARS (Vite DEFINE / 環境変数):
 *   VITE_COGNITO_DOMAIN    例: https://saborou-auth-dev.auth.ap-northeast-1.amazoncognito.com
 *   VITE_COGNITO_CLIENT_ID 例: xxxxxxxxxxxxxxxxxxxxxxxx
 */

// ---------------------------------------------------------------------------
// 設定値（Vite の import.meta.env / define 経由）
// ---------------------------------------------------------------------------

/** Cognito Hosted UI のドメイン URL（末尾スラッシュなし） */
function getCognitoDomain(): string {
  // @ts-expect-error -- Vite define or env
  const v =
    typeof VITE_COGNITO_DOMAIN !== "undefined"
      ? VITE_COGNITO_DOMAIN
      : (import.meta.env?.VITE_COGNITO_DOMAIN as string | undefined);
  if (!v) {
    throw new Error("[cognitoAuth] VITE_COGNITO_DOMAIN is not defined");
  }
  return v;
}

/** Cognito App Client ID */
function getClientId(): string {
  // @ts-expect-error -- Vite define or env
  const v =
    typeof VITE_COGNITO_CLIENT_ID !== "undefined"
      ? VITE_COGNITO_CLIENT_ID
      : (import.meta.env?.VITE_COGNITO_CLIENT_ID as string | undefined);
  if (!v) {
    throw new Error("[cognitoAuth] VITE_COGNITO_CLIENT_ID is not defined");
  }
  return v;
}

/**
 * Chrome 拡張のコールバック URL
 * chrome.identity.getRedirectURL() は <extension-id>.chromiumapp.org/ を返す。
 * テスト環境では chrome.identity が使えないため環境変数でオーバーライド可能。
 */
export function getRedirectUri(): string {
  // @ts-expect-error -- Vite define or env
  const override =
    typeof VITE_EXTENSION_REDIRECT_URI !== "undefined"
      ? VITE_EXTENSION_REDIRECT_URI
      : (import.meta.env?.VITE_EXTENSION_REDIRECT_URI as string | undefined);
  if (override) return override;
  return chrome.identity.getRedirectURL();
}

// ---------------------------------------------------------------------------
// ストレージキー
// ---------------------------------------------------------------------------

const STORAGE_KEY = "saboru_ext_auth" as const;

interface StoredTokens {
  /** Cognito ID トークン（API Gateway 認証用 / name・email クレーム含む） */
  idToken: string;
  /** Cognito アクセストークン */
  accessToken: string;
  /** リフレッシュトークン */
  refreshToken: string;
  /** アクセストークン有効期限（Unix ms） */
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// PKCE ユーティリティ（v1 の作法を踏襲）
// ---------------------------------------------------------------------------

/** URL-safe base64 エンコード（パディングなし） */
function toBase64UrlSafe(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * code_verifier を生成（32 バイト乱数の URL-safe base64）
 * v1 実装（generateCodeVerifier）と同じアルゴリズム
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return toBase64UrlSafe(array.buffer);
}

/**
 * S256 code_challenge を生成（SHA-256 ハッシュの URL-safe base64）
 * v1 実装（generateCodeChallenge）と同じアルゴリズム
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toBase64UrlSafe(digest);
}

// ---------------------------------------------------------------------------
// Cognito Hosted UI URL 構築
// ---------------------------------------------------------------------------

/**
 * PKCE フロー開始 URL を構築する
 * state は chrome.identity.launchWebAuthFlow が内部で CSRF 保護を行うため省略可だが、
 * 念のため nonce として state を付与する。
 */
export async function buildAuthUrl(redirectUri: string): Promise<{
  url: string;
  codeVerifier: string;
  state: string;
}> {
  const state = crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(),
    redirect_uri: redirectUri,
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const url = `${getCognitoDomain()}/oauth2/authorize?${params.toString()}`;
  return { url, codeVerifier, state };
}

// ---------------------------------------------------------------------------
// トークンエンドポイント
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/** 認可コードを JWT と交換（PKCE code_verifier 付き） */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: getClientId(),
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${getCognitoDomain()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `[cognitoAuth] Token exchange failed: ${res.status} ${text}`,
    );
  }

  return res.json() as Promise<TokenResponse>;
}

/** リフレッシュトークンでアクセストークン / ID トークンを更新 */
export async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  idToken: string;
  expiresIn: number;
} | null> {
  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: getClientId(),
      refresh_token: refreshToken,
    });

    const res = await fetch(`${getCognitoDomain()}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      access_token: string;
      id_token?: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      // refresh_token grant は id_token も返す（Cognito 標準）
      idToken: data.id_token ?? "",
      expiresIn: data.expires_in,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// chrome.storage.local 永続化
// ---------------------------------------------------------------------------

/** JWT を chrome.storage.local に保存 */
export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: tokens });
}

/** chrome.storage.local からトークンを読み込む */
export async function loadTokens(): Promise<StoredTokens | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as StoredTokens | undefined;
  return stored ?? null;
}

/** chrome.storage.local のトークンを削除 */
export async function clearStoredTokens(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// トークン有効期限チェック
// ---------------------------------------------------------------------------

/** 有効期限まで 5 分以上あるか（v1 の作法と同じ余裕） */
export function isTokenValid(expiresAt: number): boolean {
  return Date.now() < expiresAt - 5 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

/**
 * 有効な ID トークンを返す。
 * - ストレージにトークンがなければ null
 * - 有効期限内なら id_token を返す
 * - 期限切れなら refresh_token でリフレッシュを試みる
 * - リフレッシュ失敗（例: refresh_token 失効）なら null（再認証が必要）
 *
 * 後続 Unit（U-V2-03 voice-hook）はこの関数を呼び出して JWT を取得し、
 * API Gateway / AgentCore への Authorization ヘッダーに付与する。
 *
 * @example
 *   const token = await getValidToken();
 *   if (!token) { // 再ログイン要求 }
 *   const res = await fetch(API_URL, {
 *     headers: { Authorization: `Bearer ${token}` }
 *   });
 */
export async function getValidToken(): Promise<string | null> {
  const stored = await loadTokens();
  if (!stored) return null;

  // 有効期限内 → id_token を返す
  if (isTokenValid(stored.expiresAt)) {
    return stored.idToken;
  }

  // 期限切れ → リフレッシュ試行
  const refreshed = await refreshTokens(stored.refreshToken);
  if (!refreshed) {
    await clearStoredTokens();
    return null;
  }

  // リフレッシュ成功 → ストレージを更新
  const updatedTokens: StoredTokens = {
    idToken: refreshed.idToken || stored.idToken,
    accessToken: refreshed.accessToken,
    refreshToken: stored.refreshToken, // refresh_token は再発行されない
    expiresAt: Date.now() + refreshed.expiresIn * 1000,
  };
  await saveTokens(updatedTokens);
  return updatedTokens.idToken;
}

/**
 * Google OAuth PKCE 認証フローを実行し、JWT を取得・保存する。
 *
 * chrome.identity.launchWebAuthFlow を使用する理由:
 *   - Manifest V3 のサービスワーカーで動作する（tabs.create と異なりバックグラウンドで安定）
 *   - コールバック URL のキャプチャが自動的（chromiumapp.org ドメインで Chrome がインターセプト）
 *   - セキュリティ上も推奨（Chrome による PKCE フロー公式サポート）
 */
export async function signIn(): Promise<void> {
  const redirectUri = getRedirectUri();
  const { url, codeVerifier, state } = await buildAuthUrl(redirectUri);

  // Hosted UI を開き、リダイレクト URL を待機
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url,
    interactive: true,
  });

  if (!responseUrl) {
    throw new Error("[cognitoAuth] Auth flow was cancelled or failed");
  }

  // コールバック URL からパラメータを抽出
  const parsed = new URL(responseUrl);
  const code = parsed.searchParams.get("code");
  const returnedState = parsed.searchParams.get("state");
  const error = parsed.searchParams.get("error");

  if (error) {
    throw new Error(`[cognitoAuth] OAuth error: ${error}`);
  }

  // state 検証（CSRF 対策）
  if (returnedState !== state) {
    throw new Error(
      "[cognitoAuth] OAuth state mismatch — possible CSRF attack",
    );
  }

  if (!code) {
    throw new Error("[cognitoAuth] Authorization code not found in response");
  }

  // 認可コード → JWT 交換
  const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri);

  await saveTokens({
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  });
}

/**
 * サインアウト: ローカルのトークンをクリアする。
 * Cognito 側のセッションを終了させる場合は Cognito の /logout エンドポイントへ
 * リダイレクトする必要があるが、拡張の UX 上は chrome.tabs.create で対応するか
 * Side Panel からブラウザを誘導する（後続 Unit で実装）。
 */
export async function signOut(): Promise<void> {
  await clearStoredTokens();
}

/**
 * ID トークンのペイロードを JWT デコードしてユーザー情報を返す。
 * v1 の parseIdToken と同じロジック。
 */
export function parseIdToken(idToken: string): {
  sub: string;
  email: string;
  name: string;
} {
  const parts = idToken.split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new Error("[cognitoAuth] Invalid ID token format");
  }
  const payload = JSON.parse(
    atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
  ) as {
    sub: string;
    email: string;
    name?: string;
    "cognito:username"?: string;
  };
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? payload["cognito:username"] ?? payload.email,
  };
}
