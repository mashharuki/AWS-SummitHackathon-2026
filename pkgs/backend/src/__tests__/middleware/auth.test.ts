/**
 * Tests for auth middleware
 *
 * Tests that:
 * - userId is extracted from JWT claims and set as Hono variable
 * - 401 is returned when claims are missing
 */

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth.js";
import { errorHandler } from "../../middleware/error-handler.js";
import type { AppEnv } from "../../types.js";

function buildApp(injectClaims?: { sub?: string }) {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    // Simulate Lambda event injection via c.env
    if (injectClaims !== undefined) {
      (c as unknown as { env: unknown }).env = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: injectClaims,
            },
          },
        },
      };
    }
    // When injectClaims is undefined, c.env stays as-is (no requestContext)
    await next();
  });

  app.use("*", authMiddleware);

  app.get("/test", (c) => {
    const userId = c.get("userId");
    return c.json({ userId });
  });

  // Register error handler so thrown AppErrors become proper HTTP responses
  app.onError(errorHandler);

  return app;
}

describe("authMiddleware", () => {
  it("sets userId from JWT claims sub", async () => {
    const app = buildApp({ sub: "user-abc" });
    const res = await app.request("/test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("user-abc");
  });

  it("returns 401 when sub is missing", async () => {
    const app = buildApp({ sub: undefined });
    const res = await app.request("/test");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when env has no requestContext", async () => {
    const app = buildApp(undefined);
    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });

  it("returns 401 when claims object is empty", async () => {
    const app = buildApp({});
    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });
});
