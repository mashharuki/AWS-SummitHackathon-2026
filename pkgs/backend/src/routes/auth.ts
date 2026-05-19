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
import { createHmac, timingSafeEqual } from "crypto";
import { Hono } from "hono";
import { env } from "../config/env.js";
import { getSlackClientSecret } from "../config/secrets.js";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoServiceConnectionRepository } from "../repositories/DynamoServiceConnectionRepository.js";
import type { AppEnv } from "../types.js";

const SLACK_OAUTH_SCOPES = [
  "channels:history",
  "groups:history",
  "im:history",
  "mpim:history",
  "users:read",
].join(",");

const SLACK_OAUTH_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";

const smClient = new SecretsManagerClient({
  region: process.env["AWS_REGION"] ?? "ap-northeast-1",
});

function signState(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyState(
  stateParam: string,
  secret: string,
): { userId: string } | null {
  try {
    const decoded = Buffer.from(stateParam, "base64url").toString("utf8");
    const { payload, mac } = JSON.parse(decoded) as {
      payload: string;
      mac: string;
    };
    const expected = signState(payload, secret);
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(mac, "hex");
    if (
      expectedBuf.length !== actualBuf.length ||
      !timingSafeEqual(expectedBuf, actualBuf)
    ) {
      return null;
    }
    return JSON.parse(payload) as { userId: string };
  } catch {
    return null;
  }
}

export function createAuthRoute(
  connectionRepository: DynamoServiceConnectionRepository,
): Hono<AppEnv> {
  const auth = new Hono<AppEnv>();

  /**
   * GET /auth/slack
   * Slack OAuth フローを開始するため、Slack の認証ページにリダイレクトする。
   * 認証が必要 (userId を使って接続を関連付けるため)。
   */
  auth.get("/slack", authMiddleware, (c) => {
    const userId = c.get("userId");
    const clientId = env.COGNITO_CLIENT_ID; // 環境変数から取得する Slack クライアント ID
    // 注: 本番環境では SLACK_CLIENT_ID を専用の環境変数にするべき。
    // この実装ではコールバック時に Secrets Manager から取得する。

    const redirectUri = `${c.req.url.replace("/auth/slack", "/auth/slack/callback")}`;

    // state パラメータに userId + HMAC-SHA256 署名をエンコードして CSRF 対策
    const oauthStateSecret = env.OAUTH_STATE_SECRET;
    const nonce = crypto.randomUUID();
    const payload = JSON.stringify({ userId, nonce });
    const mac = signState(payload, oauthStateSecret);
    const state = Buffer.from(JSON.stringify({ payload, mac })).toString(
      "base64url",
    );

    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID ?? "",
      scope: SLACK_OAUTH_SCOPES,
      redirect_uri: redirectUri,
      state,
    });

    return c.redirect(`${SLACK_OAUTH_URL}?${params.toString()}`);
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

    // Save connection record to DynamoDB
    await connectionRepository.saveForUser(userId, {
      service: "slack",
      status: "connected",
      secretArn,
      connectedAt: toIsoString(new Date()),
      expiresAt: null,
    });

    // Redirect to frontend with success
    return c.redirect(
      `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/settings?slack=connected`,
    );
  });

  return auth;
}
