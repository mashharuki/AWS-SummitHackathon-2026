/**
 * Google OAuth ルート
 *
 * GET  /auth/google          — Google OAuth 認可URL を生成して JSON で返す
 * GET  /auth/google/callback — OAuth コールバック処理・トークン交換・DynamoDB保存
 * DELETE /auth/google        — Google 連携解除
 *
 * BR-G-01: Google OAuth 2.0 フロー（Slack OAuth パターン踏襲）
 * BR-G-02: アクセストークン管理（GoogleTokenService に委譲）
 *
 * 差分4: redirect_uri は自己 URL から動的生成（Slack auth.ts と同方式）
 * 差分3: トークンは JSON 形式で Secrets Manager に保存
 */

import {
  DeleteSecretCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { toIsoString } from "@saboru/shared";
import { Hono } from "hono";
import { env } from "../config/env.js";
import { getGoogleClientSecret, saveGoogleToken } from "../config/secrets.js";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoServiceConnectionRepository } from "../repositories/DynamoServiceConnectionRepository.js";
import { GoogleTokenService } from "../services/GoogleTokenService.js";
import type { AppEnv } from "../types.js";
import type { GoogleTokenSecret } from "../types/google.js";
import { GoogleTokenResponseSchema } from "../types/google.js";
import { fetchWithTimeout } from "../utils/fetchWithTimeout.js";
import { encodeState, verifyState } from "../utils/oauthState.js";

const smClient = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? "ap-northeast-1",
});

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Google OAuth スコープ
 * - gmail.readonly: Gmail メッセージ読み取り（BR-G-04）
 * - calendar.readonly: Google Calendar 予定読み取り（BR-G-03）
 */
const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export function createGoogleAuthRoute(
  connectionRepository: DynamoServiceConnectionRepository,
): Hono<AppEnv> {
  const googleAuth = new Hono<AppEnv>();

  /**
   * GET /auth/google
   * Google OAuth フローを開始するため、Google の認証ページ URL を JSON で返す。
   * 認証が必要（userId を使って接続を関連付けるため）。
   */
  googleAuth.get("/google", authMiddleware, (c) => {
    const userId = c.get("userId");
    const clientId = env.GOOGLE_CLIENT_ID;

    // redirect_uri: 自己 URL から動的生成（差分4）
    const redirectUri = c.req.url.replace(
      "/auth/google",
      "/auth/google/callback",
    );

    // state パラメータに userId + HMAC-SHA256 署名をエンコードして CSRF 対策
    const oauthStateSecret = env.OAUTH_STATE_SECRET;
    const state = encodeState(userId, oauthStateSecret);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_OAUTH_SCOPES,
      state,
      access_type: "offline", // refresh_token 取得に必須
      prompt: "consent", // 既存連携でも必ず refresh_token を返す（BR-G-01）
    });

    return c.json({ url: `${GOOGLE_AUTH_URL}?${params.toString()}` });
  });

  /**
   * GET /auth/google/callback
   * Google からのコールバック処理・トークン交換・Secrets Manager 保存・DynamoDB 保存
   */
  googleAuth.get("/google/callback", async (c) => {
    const code = c.req.query("code");
    const stateParam = c.req.query("state");
    const error = c.req.query("error");

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

    if (error) {
      return c.redirect(`${frontendUrl}/settings?google=error`);
    }

    if (!code || !stateParam) {
      return c.json(
        {
          error: {
            code: "INVALID_CALLBACK",
            message: "Missing code or state parameter",
          },
        },
        400,
      );
    }

    // HMAC 署名を検証してから state から userId を復元（CSRF 対策）
    const oauthStateSecret = env.OAUTH_STATE_SECRET;
    const verified = verifyState(stateParam, oauthStateSecret);
    if (!verified) {
      return c.json(
        {
          error: {
            code: "INVALID_STATE",
            message: "Invalid or tampered state parameter",
          },
        },
        400,
      );
    }
    const userId = verified.userId;

    // Google client secret を取得（JSON形式: { clientId, clientSecret }）
    const clientSecretArn = env.GOOGLE_CLIENT_SECRET_ARN;
    const clientSecretJson = await getGoogleClientSecret(clientSecretArn);
    const { clientId, clientSecret } = JSON.parse(clientSecretJson) as {
      clientId: string;
      clientSecret: string;
    };

    // redirect_uri: コールバック URL から query を除いたベース（差分4）
    const redirectUri = c.req.url.split("?")[0];

    // code → トークン交換（タイムアウト: 10秒）
    const tokenResponse = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      return c.json(
        {
          error: {
            code: "TOKEN_EXCHANGE_FAILED",
            message: `Google token exchange failed: ${tokenResponse.status}`,
          },
        },
        500,
      );
    }

    const rawTokenData = await tokenResponse.json();
    const parseResult = GoogleTokenResponseSchema.safeParse(rawTokenData);
    if (!parseResult.success) {
      return c.json(
        {
          error: {
            code: "TOKEN_EXCHANGE_FAILED",
            message: "Google token exchange response validation failed",
          },
        },
        500,
      );
    }

    const tokenData = parseResult.data;
    // refresh_token の存在チェック（access_type=offline + prompt=consent で必ず返るはずだが型上は optional）
    if (!tokenData.refresh_token) {
      return c.json(
        {
          error: {
            code: "TOKEN_EXCHANGE_FAILED",
            message:
              "Google did not return refresh_token. Ensure access_type=offline and prompt=consent.",
          },
        },
        500,
      );
    }
    const expiresAt = GoogleTokenService.computeExpiresAt(tokenData.expires_in);

    // トークンを JSON 形式で Secrets Manager に保存（差分3）
    const secretName = GoogleTokenService.buildSecretName(userId);
    const tokenSecret: GoogleTokenSecret = {
      refreshToken: tokenData.refresh_token,
      accessToken: tokenData.access_token,
      expiresAt,
      scope: tokenData.scope,
    };
    const secretArn = await saveGoogleToken(userId, secretName, tokenSecret);

    // ServiceConnections DynamoDB に CONN#google レコードを upsert
    await connectionRepository.saveForUser(userId, {
      service: "google",
      status: "connected",
      secretArn,
      googleScopes: tokenData.scope,
      googleAccessTokenExpiresAt: expiresAt,
      connectedAt: toIsoString(new Date()),
      expiresAt: null, // refreshToken に有効期限なし
    });

    return c.redirect(`${frontendUrl}/settings?google=connected`);
  });

  /**
   * DELETE /auth/google
   * Google 連携解除
   */
  googleAuth.delete("/google", authMiddleware, async (c) => {
    const userId = c.get("userId");

    // DynamoDB の接続レコードを disconnected に更新
    await connectionRepository.disconnect(userId, "google");

    // Secrets Manager の Google トークンシークレットを削除（長期トークンの残留を防ぐ）
    const secretName = GoogleTokenService.buildSecretName(userId);
    try {
      await smClient.send(
        new DeleteSecretCommand({
          SecretId: secretName,
          ForceDeleteWithoutRecovery: true,
        }),
      );
    } catch (err) {
      // シークレットが存在しない場合（連携前に解除操作など）は無視する
      if ((err as { name?: string }).name !== "ResourceNotFoundException") {
        throw err;
      }
    }

    return c.json({ success: true });
  });

  return googleAuth;
}
