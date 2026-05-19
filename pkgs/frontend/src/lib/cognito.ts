/**
 * Cognito OAuth 連携ライブラリ
 * NFR-DESIGN-1: メモリ内トークン管理（XSS対策）
 * NFR-DESIGN-2: OAuth CSRF 防止
 */

const COGNITO_DOMAIN = import.meta.env["VITE_COGNITO_DOMAIN"] as string;
const CLIENT_ID = import.meta.env["VITE_COGNITO_CLIENT_ID"] as string;
const REDIRECT_URI = import.meta.env["VITE_OAUTH_REDIRECT_URI"] as string;
const USER_POOL_ID = import.meta.env["VITE_COGNITO_USER_POOL_ID"] as string;

// NFR-DESIGN-1: アクセストークンをメモリ内に保持（XSS対策）
let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _tokenExpiry: number | null = null;

export function setAccessToken(token: string, expiresIn = 3600) {
  _accessToken = token;
  _tokenExpiry = Date.now() + expiresIn * 1000;
}

export function getAccessToken(): string | null {
  if (!_accessToken || !_tokenExpiry) return null;
  // 5分前に期限切れとみなす
  if (Date.now() > _tokenExpiry - 5 * 60 * 1000) return null;
  return _accessToken;
}

export function setRefreshToken(token: string) {
  _refreshToken = token;
  // refreshTokenはlocalStorageに保存（ページリロード対応）
  try {
    localStorage.setItem("saboru_rt", token);
  } catch {
    // ストレージエラーを無視
  }
}

export function getRefreshToken(): string | null {
  if (_refreshToken) return _refreshToken;
  try {
    return localStorage.getItem("saboru_rt");
  } catch {
    return null;
  }
}

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  _tokenExpiry = null;
  try {
    localStorage.removeItem("saboru_rt");
  } catch {
    // ignore
  }
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/** NFR-DESIGN-2: Cognito Hosted UI URL を構築（CSRF state + PKCE 付き） */
export async function buildCognitoAuthUrl(): Promise<string> {
  const state = crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  sessionStorage.setItem("oauth_state", state);
  sessionStorage.setItem("pkce_verifier", codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
}

/** OAuth コールバックの state を検証 */
export function validateOAuthState(receivedState: string): boolean {
  const expectedState = sessionStorage.getItem("oauth_state");
  sessionStorage.removeItem("oauth_state");
  return expectedState === receivedState;
}

/** 認証コードをトークンと交換 (PKCE code_verifier 付き) */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier?: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}> {
  const paramsObj: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
  };
  if (codeVerifier) {
    paramsObj["code_verifier"] = codeVerifier;
  }
  const params = new URLSearchParams(paramsObj);

  const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    id_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    expiresIn: data.expires_in,
  };
}

/** リフレッシュトークンでアクセストークンを更新 */
export async function refreshAccessToken(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;

  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: rt,
    });

    const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };

    setAccessToken(data.access_token, data.expires_in);
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

/** IDトークンからユーザー情報を取得 */
export function parseIdToken(idToken: string): {
  sub: string;
  email: string;
  name: string;
} {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("Invalid ID token");
  const decoded = JSON.parse(
    atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
  ) as {
    sub: string;
    email: string;
    name?: string;
    "cognito:username"?: string;
  };
  return {
    sub: decoded.sub,
    email: decoded.email,
    name: decoded.name ?? decoded["cognito:username"] ?? decoded.email,
  };
}

/** Cognito サインアウト URL */
export function buildSignOutUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: `${window.location.origin}/login`,
  });
  return `${COGNITO_DOMAIN}/logout?${params.toString()}`;
}

export { USER_POOL_ID };
