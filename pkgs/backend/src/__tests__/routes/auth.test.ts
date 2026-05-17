/**
 * Tests for auth routes (minimal - OAuth flow requires external Slack API)
 *
 * GET /auth/slack — redirect initiation
 * GET /auth/slack/callback — error cases (invalid state, missing params)
 */

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createAuthRoute } from "../../routes/auth.js";
import type { DynamoServiceConnectionRepository } from "../../repositories/DynamoServiceConnectionRepository.js";
import type { AppEnv } from "../../types.js";
import { errorHandler } from "../../middleware/error-handler.js";

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

const MOCK_USER_ID = "user-auth-test";

function buildTestApp(connRepo: Partial<DynamoServiceConnectionRepository>) {
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
    createAuthRoute(connRepo as DynamoServiceConnectionRepository),
  );
  app.onError(errorHandler);
  return app;
}

describe("GET /auth/slack", () => {
  it("redirects (302) to Slack OAuth", async () => {
    const connRepo = {};
    const app = buildTestApp(connRepo);

    const res = await app.request("/auth/slack");
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("slack.com/oauth/v2/authorize");
  });

  it("returns 401 when auth middleware rejects (no JWT claims)", async () => {
    // Build an app without injecting userId (simulates missing JWT)
    const app = new Hono<AppEnv>();
    // Do NOT inject requestContext → authMiddleware throws 401
    app.route(
      "/auth",
      createAuthRoute({} as DynamoServiceConnectionRepository),
    );
    app.onError(errorHandler);

    const res = await app.request("/auth/slack");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("GET /auth/slack/callback error cases", () => {
  it("returns 400 for OAuth denied (error param)", async () => {
    const connRepo = {};
    const app = buildTestApp(connRepo);

    const res = await app.request("/auth/slack/callback?error=access_denied");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("OAUTH_DENIED");
  });

  it("returns 400 for missing code and state", async () => {
    const connRepo = {};
    const app = buildTestApp(connRepo);

    const res = await app.request("/auth/slack/callback");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_CALLBACK");
  });

  it("returns 400 for invalid state (bad base64)", async () => {
    const connRepo = {};
    const app = buildTestApp(connRepo);

    const res = await app.request(
      "/auth/slack/callback?code=abc&state=!!!invalid!!!",
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_STATE");
  });
});
