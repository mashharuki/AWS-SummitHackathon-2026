/**
 * Tests for GET /auth/slack/callback success paths
 *
 * These tests cover the OAuth callback flow that requires mocking:
 * - Secrets Manager (getSlackClientSecret)
 * - Slack token exchange API (fetch)
 * - SecretsManagerClient (CreateSecretCommand / UpdateSecretCommand)
 * - DynamoServiceConnectionRepository.saveForUser
 *
 * All external calls are mocked — no AWS charges, no network calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../../types.js";
import { errorHandler } from "../../middleware/error-handler.js";

// Must use vi.hoisted to create mocks that can be referenced in vi.mock factories
const { mockSend, mockGetSlackClientSecret, mockFetch } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockGetSlackClientSecret: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("../../config/secrets.js", () => ({
  getSlackClientSecret: mockGetSlackClientSecret,
  getSlackSigningSecret: vi.fn(),
  _resetSecretsCache: vi.fn(),
}));

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = mockSend;
  },
  CreateSecretCommand: class {
    constructor(public input: unknown) {}
  },
  UpdateSecretCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock("../../config/env.js", () => ({
  env: {
    COGNITO_USER_POOL_ID: "ap-northeast-1_test",
    COGNITO_CLIENT_ID: "client-id-test",
    DYNAMODB_TABLE_USERS: "users-test",
    DYNAMODB_TABLE_CONNECTIONS: "conns-test",
    DYNAMODB_TABLE_TASK_CANDIDATES: "cands-test",
    DYNAMODB_TABLE_TASKS: "tasks-test",
    DYNAMODB_TABLE_PROPOSALS: "proposals-test",
    DYNAMODB_TABLE_HONNE_DATA: "honne-test",
    DYNAMODB_TABLE_PERSONAS: "personas-test",
    SLACK_SIGNING_SECRET_ARN: "arn:test:signing",
    SLACK_CLIENT_SECRET_ARN: "arn:test:client",
    EVENT_BUS_NAME: "test-bus",
  },
}));

// Replace global fetch with our mock
vi.stubGlobal("fetch", mockFetch);

const MOCK_USER_ID = "user-callback-test";

async function buildTestApp(connRepo: Record<string, unknown> = {}) {
  const { createAuthRoute } = await import("../../routes/auth.js");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    (c as unknown as { env: unknown }).env = {
      requestContext: {
        authorizer: { jwt: { claims: { sub: MOCK_USER_ID } } },
      },
    };
    await next();
  });
  app.route(
    "/auth",
    createAuthRoute(
      connRepo as unknown as Parameters<typeof createAuthRoute>[0],
    ),
  );
  app.onError(errorHandler);
  return app;
}

// Valid base64url state encoding userId
const validState = Buffer.from(
  JSON.stringify({ userId: MOCK_USER_ID }),
).toString("base64url");

describe("GET /auth/slack/callback — success path (new secret)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSend.mockReset();
    mockGetSlackClientSecret.mockReset();
    mockFetch.mockReset();
  });

  it("exchanges code, creates secret, saves connection, returns 302 redirect", async () => {
    // Slack token exchange returns success
    mockGetSlackClientSecret.mockResolvedValue(
      JSON.stringify({
        clientId: "slack-client-id",
        clientSecret: "slack-client-secret",
      }),
    );
    mockFetch.mockResolvedValue({
      json: async () => ({
        ok: true,
        access_token: "xoxb-test-token",
        team: { id: "T123", name: "TestTeam" },
      }),
    });
    // CreateSecretCommand succeeds
    mockSend.mockResolvedValue({
      ARN: "arn:aws:secretsmanager:ap-northeast-1:123:secret/token",
    });

    const connRepo = { saveForUser: vi.fn().mockResolvedValue({}) };
    const app = await buildTestApp(connRepo);

    const res = await app.request(
      `/auth/slack/callback?code=test-code&state=${validState}`,
    );
    // Should redirect to frontend with slack=connected
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("slack=connected");
    expect(connRepo.saveForUser).toHaveBeenCalledOnce();
  });

  it("updates existing secret when ResourceExistsException thrown on create", async () => {
    mockGetSlackClientSecret.mockResolvedValue(
      JSON.stringify({
        clientId: "slack-client-id",
        clientSecret: "slack-client-secret",
      }),
    );
    mockFetch.mockResolvedValue({
      json: async () => ({
        ok: true,
        access_token: "xoxb-existing-token",
        team: { id: "T456", name: "ExistingTeam" },
      }),
    });

    // First call (CreateSecretCommand) throws ResourceExistsException
    const resourceExistsError = Object.assign(new Error("already exists"), {
      name: "ResourceExistsException",
    });
    // Second call (UpdateSecretCommand) succeeds
    mockSend.mockRejectedValueOnce(resourceExistsError).mockResolvedValueOnce({
      ARN: "arn:aws:secretsmanager:ap-northeast-1:123:secret/existing",
    });

    const connRepo = { saveForUser: vi.fn().mockResolvedValue({}) };
    const app = await buildTestApp(connRepo);

    const res = await app.request(
      `/auth/slack/callback?code=existing-code&state=${validState}`,
    );
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("slack=connected");
  });

  it("returns 500 when token exchange fails (ok=false)", async () => {
    mockGetSlackClientSecret.mockResolvedValue(
      JSON.stringify({
        clientId: "slack-client-id",
        clientSecret: "slack-client-secret",
      }),
    );
    mockFetch.mockResolvedValue({
      json: async () => ({
        ok: false,
        error: "invalid_code",
      }),
    });

    const connRepo = {};
    const app = await buildTestApp(connRepo);

    const res = await app.request(
      `/auth/slack/callback?code=bad-code&state=${validState}`,
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("TOKEN_EXCHANGE_FAILED");
  });

  it("rethrows unexpected error from CreateSecretCommand (not ResourceExistsException)", async () => {
    mockGetSlackClientSecret.mockResolvedValue(
      JSON.stringify({
        clientId: "slack-client-id",
        clientSecret: "slack-client-secret",
      }),
    );
    mockFetch.mockResolvedValue({
      json: async () => ({
        ok: true,
        access_token: "xoxb-token",
        team: { id: "T789" },
      }),
    });

    // Non-ResourceExistsException error → should propagate
    mockSend.mockRejectedValue(new Error("InternalServerError"));

    const connRepo = {};
    const app = await buildTestApp(connRepo);

    const res = await app.request(
      `/auth/slack/callback?code=err-code&state=${validState}`,
    );
    // errorHandler catches unhandled errors as 500
    expect(res.status).toBe(500);
  });
});
