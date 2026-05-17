/**
 * Slack Webhook route
 *
 * POST /webhooks/slack — Receive Slack events (US-13)
 *
 * Security: NFR-S2 Slack HMAC signature verification
 * Performance: NFR-P3 EventBridge fire-and-forget (Slack 3-second timeout compliance)
 *
 * Flow:
 * 1. Verify X-Slack-Signature header (HMAC-SHA256)
 * 2. Handle url_verification challenge (Slack app setup)
 * 3. Forward event to EventBridge (async, fire-and-forget)
 * 4. Return 200 immediately to Slack
 *
 * Note: This route is deployed as a SEPARATE Lambda (webhook-handler.ts)
 * to isolate the Slack signing secret from the main API Lambda.
 */

import { Hono } from "hono";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { verifySlackSignature } from "../services/slack-verification.js";
import { getSlackSigningSecret } from "../config/secrets.js";
import { env } from "../config/env.js";

const ebClient = new EventBridgeClient({ region: "ap-northeast-1" });

export const webhooksRoute = new Hono();

/**
 * POST /webhooks/slack
 *
 * Handles Slack Event API callbacks.
 * Supported event types:
 * - url_verification: Slack app verification (returns challenge immediately)
 * - event_callback: User message events → forwarded to EventBridge
 */
webhooksRoute.post("/slack", async (c) => {
  // Read raw body BEFORE any JSON parsing (required for HMAC verification)
  const rawBody = await c.req.text();
  const timestamp = c.req.header("x-slack-request-timestamp") ?? "";
  const signature = c.req.header("x-slack-signature") ?? "";

  // NFR-S2: HMAC verification
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

  // Slack url_verification: return challenge immediately
  if (body.type === "url_verification") {
    return c.json({ challenge: body.challenge });
  }

  // Forward to EventBridge (fire-and-forget)
  // NFR-P3: await the put to ensure delivery before Lambda returns,
  // but this should complete well within Slack's 3-second window.
  try {
    await ebClient.send(
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
  } catch (err) {
    // Log but don't fail — Slack requires 200 to avoid retries
    console.error("[WEBHOOK] EventBridge put failed", { error: String(err) });
  }

  return c.json({ ok: true });
});
