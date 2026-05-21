/**
 * Slack Webhook ルート
 *
 * POST /webhooks/slack — Slack イベントを受信する (US-13)
 *
 * セキュリティ: NFR-S2 Slack HMAC 署名検証
 * パフォーマンス: NFR-P3 EventBridge ファイアアンドフォーゲット (Slack 3秒タイムアウト満たす)
 *
 * フロー:
 * 1. X-Slack-Signature ヘッダーを検証 (HMAC-SHA256)
 * 2. url_verification チャレンジを処理 (Slack アプリセットアップ)
 * 3. イベントを EventBridge に転送 (非同期、ファイアアンドフォーゲット)
 * 4. Slack に即座に 200 を返す
 *
 * 注: このルートは別途の Lambda (webhook-handler.ts) としてデプロイされる
 * Slack 署名シークレットをメイン API Lambda から分離するため。
 */

import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { Hono } from "hono";
import { env } from "../config/env.js";
import { getSlackSigningSecret } from "../config/secrets.js";
import { verifySlackSignature } from "../services/slack-verification.js";

const ebClient = new EventBridgeClient({
  region: process.env["AWS_REGION"] ?? "ap-northeast-1",
});

export const webhooksRoute = new Hono();

/**
 * POST /webhooks/slack
 *
 * Slack Event API コールバックを処理する。
 * 対応イベントタイプ:
 * - url_verification: Slack アプリ検証 (即座に challenge を返す)
 * - event_callback: ユーザーメッセージイベント → EventBridge に転送
 */
webhooksRoute.post("/slack", async (c) => {
  // HMAC 検証のため JSON パース前に生のボディを読み取る (HMAC 検証に必須)
  const rawBody = await c.req.text();
  const timestamp = c.req.header("x-slack-request-timestamp") ?? "";
  const signature = c.req.header("x-slack-signature") ?? "";

  // NFR-S2: HMAC 検証
  const signingSecretArn = env.SLACK_SIGNING_SECRET_ARN;
  const signingSecret = await getSlackSigningSecret(signingSecretArn);

  const isValid = await verifySlackSignature(
    rawBody,
    timestamp,
    signature,
    signingSecret,
  );

  if (!isValid) {
    console.warn("[WEBHOOK] Invalid Slack signature", { timestamp });
    return c.json(
      { error: { code: "FORBIDDEN", message: "Invalid Slack signature" } },
      403,
    );
  }

  let body: {
    type: string;
    challenge?: string;
    event?: unknown;
    team_id?: string;
  };

  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return c.json(
      { error: { code: "INVALID_BODY", message: "Invalid JSON body" } },
      400,
    );
  }

  // Slack url_verification: 即座に challenge を返す
  if (body.type === "url_verification") {
    return c.json({ challenge: body.challenge });
  }

  // EventBridge に転送 (ファイアアンドフォーゲット)
  // NFR-P3: Lambda が返る前に配信を保証するため await するが、
  // Slack の 3 秒ウィンドウ内に十分完了する。
  try {
    const ebResult = await ebClient.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "saborou.webhook",
            DetailType: "SlackEvent",
            Detail: JSON.stringify({
              event: body.event,
              teamId: body.team_id,
              receivedAt: new Date().toISOString(),
            }),
            EventBusName: env.EVENT_BUS_NAME,
          },
        ],
      }),
    );
    if ((ebResult.FailedEntryCount ?? 0) > 0) {
      console.error("[WEBHOOK] EventBridge partial failure", {
        failedCount: ebResult.FailedEntryCount,
        entries: ebResult.Entries?.map((e) => ({
          errorCode: e.ErrorCode,
          errorMessage: e.ErrorMessage,
        })),
      });
    }
  } catch (err) {
    // ログするが失敗みない — Slack はリトライを避けるため 200 を必要とする
    console.error("[WEBHOOK] EventBridge put failed", { error: String(err) });
  }

  return c.json({ ok: true });
});
