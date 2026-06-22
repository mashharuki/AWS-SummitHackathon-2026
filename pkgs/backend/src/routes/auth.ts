/**
 * 認証ルート — Slack OAuth フロー
 *
 * GET /auth/slack          — Slack OAuth 認証ページへリダイレクト
 * GET /auth/slack/callback — OAuth コールバックを処理しトークンと交換
 *
 * FR-03 / US-11: Slack ワークスペース連携（OAuth 2.0）
 *
 * OAuth フロー:
 * 1. ユーザーが UI で "Slack と連携" をクリック
 * 2. フロントエンドが GET /auth/slack を呼び出し → Slack OAuth にリダイレクト
 * 3. Slack が GET /auth/slack/callback?code=xxx にリダイレクト
 * 4. バックエンドが Slack API 経由で code を bot トークンと交換
 * 5. トークンを Secrets Manager に保存し、ARN を ServiceConnections DynamoDB に登録
 */

import {
  CreateSecretCommand,
  SecretsManagerClient,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import { toIsoString } from "@saboru/shared";
import { Hono } from "hono";
import { env } from "../config/env.js";
import { getSlackClientSecret } from "../config/secrets.js";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoServiceConnectionRepository } from "../repositories/DynamoServiceConnectionRepository.js";
import type { DynamoUserRepository } from "../repositories/DynamoUserRepository.js";
import type { AppEnv } from "../types.js";
import { encodeState, verifyState } from "../utils/oauthState.js";

const SLACK_OAUTH_SCOPES = [
  "channels:history",
  "groups:history",
  "im:history",
  "mpim:history",
  "users:read",
  // channels:read / groups:read: Bot 参加チャンネル一覧の取得（users.conversations）
  // UI のチャンネル選択ドロップダウン（C-1/C-2）に必要
  "channels:read",
  "groups:read",
  // chat:write: サボり提案を Slack スレッドに返信する（インタラクティブ化）
  "chat:write",
].join(",");

const SLACK_OAUTH_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";

const smClient = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? "ap-northeast-1",
});

export function createAuthRoute(
  connectionRepository: DynamoServiceConnectionRepository,
  userRepository: DynamoUserRepository,
): Hono<AppEnv> {
  const auth = new Hono<AppEnv>();

  /**
   * GET /auth/slack
   * Slack OAuth フローを開始するため、Slack の認証ページにリダイレクトする。
   * 認証が必要 (userId を使って接続を関連付けるため)。
   */
  auth.get("/slack", authMiddleware, (c) => {
    const userId = c.get("userId");
    // Slack OAuth 開始用の client_id は専用の環境変数 SLACK_CLIENT_ID から取得する。
    // （以前は誤って COGNITO_CLIENT_ID を参照する死にコードがあったため整理した。
    //  コールバック時の token 交換は Secrets Manager の client_id/secret を使う。）
    const slackClientId = process.env.SLACK_CLIENT_ID ?? "";

    const redirectUri = `${c.req.url.replace("/auth/slack", "/auth/slack/callback")}`;

    // state パラメータに userId + HMAC-SHA256 署名をエンコードして CSRF 対策
    const oauthStateSecret = env.OAUTH_STATE_SECRET;
    const state = encodeState(userId, oauthStateSecret);

    const params = new URLSearchParams({
      client_id: slackClientId,
      scope: SLACK_OAUTH_SCOPES,
      user_scope: "chat:write",
      redirect_uri: redirectUri,
      state,
    });

    // 302 リダイレクトではなく Slack 認可 URL を JSON で返す。
    // フロントは Authorization ヘッダ付き fetch でこれを取得し、
    // 返ってきた URL へ window.location で遷移する（トークンを URL に載せない）。
    return c.json({ url: `${SLACK_OAUTH_URL}?${params.toString()}` });
  });

  /**
   * GET /auth/slack/callback
   * OAuth コードを bot トークンと交換し、接続を永続化する。
   */
  auth.get("/slack/callback", async (c) => {
    const code = c.req.query("code");
    const stateParam = c.req.query("state");
    const error = c.req.query("error");

    if (error) {
      return c.json(
        {
          error: {
            code: "OAUTH_DENIED",
            message: `Slack OAuth denied: ${error}`,
          },
        },
        400,
      );
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

    // HMAC 署名を検証してから state から userId を復元 (CSRF 対策)
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

    // Exchange code for token
    const clientSecretArn = env.SLACK_CLIENT_SECRET_ARN;
    const clientSecretJson = await getSlackClientSecret(clientSecretArn);
    const { clientId, clientSecret } = JSON.parse(clientSecretJson) as {
      clientId: string;
      clientSecret: string;
    };

    const redirectUri = `${c.req.url.split("?")[0]}`;

    const tokenResponse = await fetch(SLACK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = (await tokenResponse.json()) as {
      ok: boolean;
      access_token?: string;
      team?: { id: string; name: string };
      authed_user?: { id: string; access_token?: string };
      error?: string;
    };

    if (!tokenData.ok || !tokenData.access_token) {
      return c.json(
        {
          error: {
            code: "TOKEN_EXCHANGE_FAILED",
            message: `Slack token exchange failed: ${tokenData.error ?? "unknown"}`,
          },
        },
        500,
      );
    }

    // Store bot token in Secrets Manager
    const secretName = `saborou/slack-bot-token/${userId}`;
    let secretArn: string;

    try {
      const createResult = await smClient.send(
        new CreateSecretCommand({
          Name: secretName,
          SecretString: tokenData.access_token,
          Description: `Slack bot token for Saborou user ${userId}`,
        }),
      );
      secretArn = createResult.ARN ?? secretName;
    } catch (err) {
      if ((err as { name?: string }).name === "ResourceExistsException") {
        // Update existing secret
        const updateResult = await smClient.send(
          new UpdateSecretCommand({
            SecretId: secretName,
            SecretString: tokenData.access_token,
          }),
        );
        secretArn = updateResult.ARN ?? secretName;
      } else {
        throw err;
      }
    }

    // Store user token in Secrets Manager (xoxp- token for posting as the user)
    if (tokenData.authed_user?.access_token) {
      const userSecretName = `saborou/slack-user-token/${userId}`;
      try {
        await smClient.send(
          new CreateSecretCommand({
            Name: userSecretName,
            SecretString: tokenData.authed_user.access_token,
            Description: `Slack user token for Saborou user ${userId}`,
          }),
        );
      } catch (err) {
        if ((err as { name?: string }).name === "ResourceExistsException") {
          await smClient.send(
            new UpdateSecretCommand({
              SecretId: userSecretName,
              SecretString: tokenData.authed_user.access_token,
            }),
          );
        } else {
          throw err;
        }
      }
    }

    // Slack identity（ワークスペース・ユーザー）を取得して紐付けに使う
    const slackTeamId = tokenData.team?.id;
    const slackUserId = tokenData.authed_user?.id;

    await connectionRepository.saveForUser(userId, {
      service: "slack",
      status: "connected",
      secretArn,
      ...(slackUserId ? { slackUserId } : {}),
      ...(slackTeamId ? { slackTeamId } : {}),
      connectedAt: toIsoString(new Date()),
      expiresAt: null,
      ...(tokenData.authed_user?.id
        ? { slackUserId: tokenData.authed_user.id }
        : {}),
    });

    // Cognito ユーザーのプロフィールにも Slack identity を保存する。
    // これにより受信 Slack イベントを Cognito ユーザーに逆引きできる。
    if (slackUserId && slackTeamId) {
      const existing = await userRepository.findById(userId);
      if (existing) {
        await userRepository.upsert({
          ...existing,
          slackUserId,
          slackTeamId,
          updatedAt: toIsoString(new Date()),
        });
      }
    }

    // 拡張機能経由の場合はリダイレクト不要。このタブを閉じる成功ページを返す。
    // FRONTEND_URL が設定されている場合はフロントへリダイレクト（後方互換）。
    const frontendUrl = process.env.FRONTEND_URL;
    if (frontendUrl && !frontendUrl.includes("localhost")) {
      return c.redirect(`${frontendUrl}/settings?slack=connected`);
    }
    return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Slack連携完了 - SABOROU</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fffaf5; }
    .card { text-align: center; padding: 2rem; background: white; border-radius: 1rem; border: 2px solid #2b1e16; box-shadow: 0 4px 0 #2b1e16; max-width: 320px; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; font-weight: 900; color: #1f2937; margin: 0 0 0.5rem; }
    p { font-size: 0.875rem; color: #6b7280; margin: 0 0 1.5rem; }
    button { background: #f97316; color: white; border: none; border-radius: 0.5rem; padding: 0.75rem 2rem; font-size: 0.875rem; font-weight: 700; cursor: pointer; }
    button:hover { background: #ea6c0a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Slack連携が完了しました</h1>
    <p>SABOROUとSlackが接続されました。このタブを閉じて拡張機能に戻ってください。</p>
    <button onclick="window.close()">このタブを閉じる</button>
  </div>
</body>
</html>`);
  });

  return auth;
}
