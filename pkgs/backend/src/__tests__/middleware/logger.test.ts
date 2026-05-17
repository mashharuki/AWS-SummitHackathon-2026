/**
 * Tests for request logger middleware
 */

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { requestLogger } from "../../middleware/logger.js";

describe("requestLogger", () => {
  it("logs request with status 200 at INFO level", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = new Hono();
    app.use("*", requestLogger);
    app.get("/test", (c) => c.json({ ok: true }));

    await app.request("/test");

    expect(consoleSpy).toHaveBeenCalledOnce();
    const logArg = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logArg);
    expect(parsed.level).toBe("INFO");
    expect(parsed.method).toBe("GET");
    expect(parsed.path).toBe("/test");
    expect(parsed.status).toBe(200);
    expect(typeof parsed.durationMs).toBe("number");
    consoleSpy.mockRestore();
  });

  it("logs at WARN level for 4xx status", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = new Hono();
    app.use("*", requestLogger);
    app.get("/test", (c) => c.json({ error: "not found" }, 404));

    await app.request("/test");

    const logArg = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logArg);
    expect(parsed.level).toBe("WARN");
    consoleSpy.mockRestore();
  });

  it("logs at ERROR level for 5xx status", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = new Hono();
    app.use("*", requestLogger);
    app.get("/test", (c) => c.json({ error: "server error" }, 500));

    await app.request("/test");

    const logArg = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logArg);
    expect(parsed.level).toBe("ERROR");
    consoleSpy.mockRestore();
  });

  it("includes action field as 'request'", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = new Hono();
    app.use("*", requestLogger);
    app.post("/test", (c) => c.json({}, 201));

    await app.request("/test", { method: "POST" });

    const logArg = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logArg);
    expect(parsed.action).toBe("request");
    expect(parsed.method).toBe("POST");
    consoleSpy.mockRestore();
  });
});
