/**
 * Tests for connection routes
 */

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createConnectionsRoute } from "../../routes/connections.js";
import type { DynamoServiceConnectionRepository } from "../../repositories/DynamoServiceConnectionRepository.js";
import type { ServiceConnection } from "@saboru/shared";
import type { AppEnv } from "../../types.js";
import { errorHandler } from "../../middleware/error-handler.js";

const MOCK_USER_ID = "user-conn-test";

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
    "/connections",
    createConnectionsRoute(connRepo as DynamoServiceConnectionRepository),
  );
  app.onError(errorHandler);
  return app;
}

const sampleConnection: ServiceConnection = {
  PK: "USER#user-conn-test",
  SK: "CONN#slack",
  service: "slack",
  status: "connected",
  secretArn: "arn:aws:secretsmanager:ap-northeast-1:123:secret/token",
  connectedAt: "2026-05-17T00:00:00Z",
  expiresAt: null,
};

describe("GET /connections", () => {
  it("returns connection list", async () => {
    const connRepo = {
      findAllByUserId: vi.fn().mockResolvedValue([sampleConnection]),
    };
    const app = buildTestApp(connRepo);

    const res = await app.request("/connections");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connections).toHaveLength(1);
    expect(body.connections[0].service).toBe("slack");
  });

  it("returns empty array when no connections", async () => {
    const connRepo = { findAllByUserId: vi.fn().mockResolvedValue([]) };
    const app = buildTestApp(connRepo);

    const res = await app.request("/connections");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connections).toHaveLength(0);
  });
});

describe("DELETE /connections/:service", () => {
  it("disconnects slack and returns 204", async () => {
    const connRepo = {
      findByUserAndService: vi.fn().mockResolvedValue(sampleConnection),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const app = buildTestApp(connRepo);

    const res = await app.request("/connections/slack", { method: "DELETE" });
    expect(res.status).toBe(204);
    expect(vi.mocked(connRepo.disconnect)).toHaveBeenCalledWith(
      MOCK_USER_ID,
      "slack",
    );
  });

  it("returns 404 when connection not found", async () => {
    const connRepo = {
      findByUserAndService: vi.fn().mockResolvedValue(null),
      disconnect: vi.fn(),
    };
    const app = buildTestApp(connRepo);

    const res = await app.request("/connections/slack", { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid service name", async () => {
    const connRepo = { findByUserAndService: vi.fn() };
    const app = buildTestApp(connRepo);

    const res = await app.request("/connections/invalid_service", {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_SERVICE");
  });
});
