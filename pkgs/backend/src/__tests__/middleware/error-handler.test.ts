/**
 * Tests for global error handler middleware
 */

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { errorHandler } from "../../middleware/error-handler.js";
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ConflictError,
} from "../../errors.js";

function buildApp(routeHandler: () => never | Response) {
  const app = new Hono();
  app.get("/test", () => {
    routeHandler();
    return new Response("ok"); // unreachable
  });
  app.onError(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("returns 404 for NotFoundError", async () => {
    const app = buildApp(() => {
      throw new NotFoundError("thing not found");
    });
    const res = await app.request("/test");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("thing not found");
  });

  it("returns 403 for ForbiddenError", async () => {
    const app = buildApp(() => {
      throw new ForbiddenError();
    });
    const res = await app.request("/test");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 for UnauthorizedError", async () => {
    const app = buildApp(() => {
      throw new UnauthorizedError("not authenticated");
    });
    const res = await app.request("/test");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 409 for ConflictError", async () => {
    const app = buildApp(() => {
      throw new ConflictError("already exists");
    });
    const res = await app.request("/test");
    expect(res.status).toBe(409);
  });

  it("returns 500 for unknown errors", async () => {
    const app = buildApp(() => {
      throw new Error("unexpected error");
    });
    const res = await app.request("/test");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("handles HTTP errors with status field", async () => {
    const app = buildApp(() => {
      const err = Object.assign(new Error("not allowed"), { status: 405 });
      throw err;
    });
    const res = await app.request("/test");
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error.code).toBe("HTTP_ERROR");
  });

  it("returns custom statusCode for AppError subclass", async () => {
    const app = buildApp(() => {
      throw new AppError(422, "UNPROCESSABLE", "invalid entity");
    });
    const res = await app.request("/test");
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("UNPROCESSABLE");
  });
});
