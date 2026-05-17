/**
 * Tests for GET /health
 */

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { healthRoute } from "../../routes/health.js";

describe("GET /health", () => {
  const app = new Hono();
  app.route("/health", healthRoute);

  it("returns 200 with status ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("saborou-api");
    expect(typeof body.timestamp).toBe("string");
  });

  it("does not require authentication", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
  });
});
