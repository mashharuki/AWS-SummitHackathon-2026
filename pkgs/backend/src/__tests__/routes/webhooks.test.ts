/**
 * Tests for POST /webhooks/slack
 *
 * Tests HMAC verification, url_verification challenge, and EventBridge forwarding.
 * Uses vi.mock to stub Secrets Manager and EventBridge clients.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHmac } from "crypto";
import { errorHandler } from "../../middleware/error-handler.js";

const SIGNING_SECRET = "test-webhook-signing-secret";

function makeSignature(body: string, timestamp: string): string {
  return `v0=${createHmac("sha256", SIGNING_SECRET)
    .update(`v0:${timestamp}:${body}`)
    .digest("hex")}`;
}

function nowTs(): string {
  return String(Math.floor(Date.now() / 1000));
}

// Mock modules before any imports that reference them
vi.mock("../../config/secrets.js", () => ({
  getSlackSigningSecret: vi.fn().mockResolvedValue(SIGNING_SECRET),
  getSlackClientSecret: vi.fn().mockResolvedValue("{}"),
  _resetSecretsCache: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({
  env: new Proxy({} as Record<string, string>, {
    get: (_target, prop: string) => {
      const defaults: Record<string, string> = {
        SLACK_SIGNING_SECRET_ARN: "arn:test:signing",
        EVENT_BUS_NAME: "test-bus",
        COGNITO_USER_POOL_ID: "pool-id",
        COGNITO_CLIENT_ID: "client-id",
        DYNAMODB_TABLE_USERS: "users",
        DYNAMODB_TABLE_CONNECTIONS: "conns",
        DYNAMODB_TABLE_TASK_CANDIDATES: "cands",
        DYNAMODB_TABLE_TASKS: "tasks",
        DYNAMODB_TABLE_PROPOSALS: "proposals",
        DYNAMODB_TABLE_HONNE_DATA: "honne",
        DYNAMODB_TABLE_PERSONAS: "personas",
        SLACK_CLIENT_SECRET_ARN: "arn:test:client",
      };
      return defaults[prop] ?? "";
    },
  }),
}));

const mockSend = vi.fn().mockResolvedValue({ FailedEntryCount: 0 });

vi.mock("@aws-sdk/client-eventbridge", () => ({
  EventBridgeClient: vi.fn().mockImplementation(function (this: unknown) {
    (this as { send: typeof mockSend }).send = mockSend;
  }),
  PutEventsCommand: vi.fn().mockImplementation((input: unknown) => input),
}));

describe("POST /webhooks/slack", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ FailedEntryCount: 0 });
    // Reset module cache so new mock state is picked up
    vi.resetModules();
    // Re-apply mocks after resetModules
    vi.mock("../../config/secrets.js", () => ({
      getSlackSigningSecret: vi.fn().mockResolvedValue(SIGNING_SECRET),
    }));
    vi.mock("../../config/env.js", () => ({
      env: new Proxy({} as Record<string, string>, {
        get: (_target, prop: string) => {
          const defaults: Record<string, string> = {
            SLACK_SIGNING_SECRET_ARN: "arn:test:signing",
            EVENT_BUS_NAME: "test-bus",
          };
          return defaults[prop] ?? "";
        },
      }),
    }));
    vi.mock("@aws-sdk/client-eventbridge", () => ({
      EventBridgeClient: vi.fn().mockImplementation(function (this: unknown) {
        (this as { send: typeof mockSend }).send = mockSend;
      }),
      PutEventsCommand: vi.fn().mockImplementation((input: unknown) => input),
    }));

    const { webhooksRoute } = await import("../../routes/webhooks.js");
    app = new Hono();
    app.route("/webhooks", webhooksRoute);
    app.onError(errorHandler);
  });

  it("returns challenge for url_verification", async () => {
    const body = JSON.stringify({
      type: "url_verification",
      challenge: "abc123",
    });
    const ts = nowTs();
    const sig = makeSignature(body, ts);

    const res = await app.request("/webhooks/slack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": ts,
        "x-slack-signature": sig,
      },
      body,
    });
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.challenge).toBe("abc123");
  });

  it("forwards event to EventBridge and returns ok", async () => {
    const body = JSON.stringify({
      type: "event_callback",
      event: { type: "message", text: "hello" },
      team_id: "T123",
    });
    const ts = nowTs();
    const sig = makeSignature(body, ts);

    const res = await app.request("/webhooks/slack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": ts,
        "x-slack-signature": sig,
      },
      body,
    });
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.ok).toBe(true);
  });

  it("returns 403 for invalid signature", async () => {
    const body = JSON.stringify({ type: "event_callback" });
    const ts = nowTs();

    const res = await app.request("/webhooks/slack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": ts,
        "x-slack-signature":
          "v0=invalidsignature1234567890123456789012345678901234567890",
      },
      body,
    });
    expect(res.status).toBe(403);
    const resBody = await res.json();
    expect(resBody.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 for expired timestamp", async () => {
    const body = JSON.stringify({ type: "event_callback" });
    const oldTs = String(Math.floor(Date.now() / 1000) - 600);
    const sig = makeSignature(body, oldTs);

    const res = await app.request("/webhooks/slack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": oldTs,
        "x-slack-signature": sig,
      },
      body,
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid JSON body", async () => {
    const body = "not-json";
    const ts = nowTs();
    const sig = makeSignature(body, ts);

    const res = await app.request("/webhooks/slack", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "x-slack-request-timestamp": ts,
        "x-slack-signature": sig,
      },
      body,
    });
    expect(res.status).toBe(400);
    const resBody = await res.json();
    expect(resBody.error.code).toBe("INVALID_BODY");
  });

  it("returns ok even if EventBridge fails (Slack retry prevention)", async () => {
    mockSend.mockRejectedValueOnce(new Error("EventBridge error"));

    const body = JSON.stringify({
      type: "event_callback",
      event: {},
      team_id: "T999",
    });
    const ts = nowTs();
    const sig = makeSignature(body, ts);

    const res = await app.request("/webhooks/slack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": ts,
        "x-slack-signature": sig,
      },
      body,
    });
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.ok).toBe(true);
  });

  it("returns 403 when x-slack-request-timestamp header is missing (falls back to empty string)", async () => {
    // Missing header → timestamp = "" → verifySlackSignature returns false
    const body = JSON.stringify({ type: "event_callback" });

    const res = await app.request("/webhooks/slack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // No x-slack-request-timestamp
        "x-slack-signature":
          "v0=invalidsig1234567890123456789012345678901234567890",
      },
      body,
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when x-slack-signature header is missing (falls back to empty string)", async () => {
    const body = JSON.stringify({ type: "event_callback" });
    const ts = nowTs();

    const res = await app.request("/webhooks/slack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slack-request-timestamp": ts,
        // No x-slack-signature
      },
      body,
    });
    expect(res.status).toBe(403);
  });
});
