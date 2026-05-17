/**
 * Auth routes — Slack OAuth flow
 *
 * GET /auth/slack          — Redirect to Slack OAuth authorization page
 * GET /auth/slack/callback — Handle OAuth callback, exchange code for token
 *
 * FR-03 / US-11: Slack Workspace連携（OAuth 2.0）
 *
 * OAuth flow:
 * 1. User clicks "Connect Slack" in UI
 * 2. Frontend calls GET /auth/slack → redirect to Slack OAuth
 * 3. Slack redirects to GET /auth/slack/callback?code=xxx
 * 4. Backend exchanges code for bot token via Slack API
 * 5. Token stored in Secrets Manager, ARN saved to ServiceConnections DynamoDB
 */

import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoServiceConnectionRepository } from "../repositories/DynamoServiceConnectionRepository.js";
import { getSlackClientSecret } from "../config/secrets.js";
import { env } from "../config/env.js";
import {
  SecretsManagerClient,
  CreateSecretCommand,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import { toIsoString } from "@saboru/shared";

const SLACK_OAUTH_SCOPES = [
  "channels:history",
  "groups:history",
  "im:history",
  "mpim:history",
  "users:read",
].join(",");

const SLACK_OAUTH_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";

const smClient = new SecretsManagerClient({ region: "ap-northeast-1" });

export function createAuthRoute(
  connectionRepository: DynamoServiceConnectionRepository,
): Hono<AppEnv> {
  const auth = new Hono<AppEnv>();

  /**
   * GET /auth/slack
   * Initiates Slack OAuth flow by redirecting to Slack's authorization page.
   * Requires authentication (userId needed to associate the connection).
   */
  auth.get("/slack", authMiddleware, (c) => {
    const userId = c.get("userId");
    const clientId = env.COGNITO_CLIENT_ID; // Slack client ID from env (reuse env accessor pattern)
    // Note: In production, SLACK_CLIENT_ID should be its own env var.
    // For this implementation we derive it from Secrets Manager at callback time.

    const redirectUri = `${c.req.url.replace("/auth/slack", "/auth/slack/callback")}`;

    // State parameter encodes userId to recover it at callback
    const state = Buffer.from(JSON.stringify({ userId })).toString("base64url");

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
   * Exchanges the OAuth code for a bot token and persists the connection.
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

    // Recover userId from state
    let userId: string;
    try {
      const decoded = JSON.parse(
        Buffer.from(stateParam, "base64url").toString("utf8"),
      ) as { userId: string };
      userId = decoded.userId;
    } catch {
      return c.json(
        {
          error: { code: "INVALID_STATE", message: "Invalid state parameter" },
        },
        400,
      );
    }

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
