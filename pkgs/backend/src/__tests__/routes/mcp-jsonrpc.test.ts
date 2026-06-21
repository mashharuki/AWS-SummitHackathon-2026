import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createMcpJsonRpcRoute } from "../../routes/mcp-jsonrpc.js";

const verifier = async () => ({
  sub: "user-123",
  iss: "issuer",
  aud: "audience",
});

describe("POST /api/mcp JSON-RPC", () => {
  it("responds to initialize without requiring authentication", async () => {
    const app = new Hono();
    app.route(
      "/api/mcp",
      createMcpJsonRpcRoute({
        verifier,
        caller: async () => new Response("{}", { status: 200 }),
      }),
    );

    const res = await app.request("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 0,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      id: 0,
      result: {
        protocolVersion: "2025-03-26",
        serverInfo: { name: "SABOROU", version: "3.0.0" },
      },
    });
  });

  it("does not expose an SSE GET endpoint", async () => {
    const app = new Hono();
    app.route(
      "/api/mcp",
      createMcpJsonRpcRoute({
        verifier,
        caller: async () => new Response("{}", { status: 200 }),
      }),
    );

    const res = await app.request("/api/mcp", {
      method: "GET",
      headers: { Accept: "text/event-stream" },
    });

    expect(res.status).toBe(404);
  });

  it("includes saborou_plan_trip in tools/list", async () => {
    const app = new Hono();
    app.route(
      "/api/mcp",
      createMcpJsonRpcRoute({
        verifier,
        caller: async () => new Response("{}", { status: 200 }),
      }),
    );

    const res = await app.request("/api/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const tripTool = body.result.tools.find(
      (tool: { name: string }) => tool.name === "saborou_plan_trip",
    );
    expect(tripTool).toMatchObject({
      name: "saborou_plan_trip",
      inputSchema: {
        additionalProperties: false,
      },
    });
    const tripPostTool = body.result.tools.find(
      (tool: { name: string }) =>
        tool.name === "saborou_plan_trip_and_post_to_slack",
    );
    expect(tripPostTool).toMatchObject({
      name: "saborou_plan_trip_and_post_to_slack",
      inputSchema: {
        additionalProperties: false,
        required: ["channelId", "approved"],
      },
    });
  });

  it("invokes saborou_plan_trip through the internal API caller", async () => {
    let captured: { path: string; init: RequestInit } | undefined;
    const app = new Hono();
    app.route(
      "/api/mcp",
      createMcpJsonRpcRoute({
        verifier,
        caller: async (path, init) => {
          captured = { path, init };
          return Response.json({
            status: "planned",
            message: "パリ旅行を組みました。",
            missingFields: [],
            sourceMode: "fixture",
            plan: {
              summary: "summary",
              assumptions: [],
              flights: [],
              hotels: [],
              activitiesByDay: [],
              nextQuestion: null,
            },
          });
        },
      }),
    );

    const res = await app.request("/api/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "saborou_plan_trip",
          arguments: {
            destination: "Paris",
            departureDate: "2026-07-10",
            returnDate: "2026-07-15",
          },
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(captured?.path).toBe("/api/travel/plan");
    expect(captured?.init.method).toBe("POST");
    expect(captured?.init.headers).toMatchObject({
      Authorization: "Bearer valid-token",
      "Content-Type": "application/json",
      "x-internal-sub": "user-123",
    });
    expect(captured?.init.body).toBe(
      JSON.stringify({
        destination: "Paris",
        departureDate: "2026-07-10",
        returnDate: "2026-07-15",
      }),
    );
    const body = await res.json();
    expect(body.result.content[0].text).toContain("パリ旅行を組みました。");
    expect(body.result.content[0].text).not.toContain("valid-token");
  });

  it("requires approved=true for saborou_plan_trip_and_post_to_slack", async () => {
    const app = new Hono();
    app.route(
      "/api/mcp",
      createMcpJsonRpcRoute({
        verifier,
        caller: async () => {
          throw new Error("should not call internal API without approval");
        },
      }),
    );

    const res = await app.request("/api/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "saborou_plan_trip_and_post_to_slack",
          arguments: {
            destination: "Paris",
            departureDate: "2026-07-10",
            returnDate: "2026-07-15",
            channelId: "C12345",
          },
        },
      }),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toContain("Tool requires explicit approval");
  });

  it("invokes saborou_plan_trip_and_post_to_slack through the internal API caller", async () => {
    let captured: { path: string; init: RequestInit } | undefined;
    const app = new Hono();
    app.route(
      "/api/mcp",
      createMcpJsonRpcRoute({
        verifier,
        caller: async (path, init) => {
          captured = { path, init };
          return Response.json({
            status: "posted",
            message: "旅行しおりURLをSlackに投稿しました。",
            missingFields: [],
            sourceMode: "fixture",
            plan: {
              summary: "summary",
              assumptions: [],
              flights: [],
              hotels: [],
              activitiesByDay: [],
              nextQuestion: null,
            },
            slack: {
              posted: true,
              channelId: "C12345",
              ts: "1718600000.123456",
            },
          });
        },
      }),
    );

    const res = await app.request("/api/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "saborou_plan_trip_and_post_to_slack",
          arguments: {
            destination: "Paris",
            departureDate: "2026-07-10",
            returnDate: "2026-07-15",
            channelId: "C12345",
            threadTs: "1718500000.111111",
            approved: true,
          },
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(captured?.path).toBe("/api/travel/plan-and-post-to-slack");
    expect(captured?.init.method).toBe("POST");
    expect(captured?.init.headers).toMatchObject({
      Authorization: "Bearer valid-token",
      "Content-Type": "application/json",
      "x-internal-sub": "user-123",
    });
    expect(captured?.init.body).toBe(
      JSON.stringify({
        destination: "Paris",
        departureDate: "2026-07-10",
        returnDate: "2026-07-15",
        channelId: "C12345",
        threadTs: "1718500000.111111",
        approved: true,
      }),
    );
    const body = await res.json();
    expect(body.result.content[0].text).toContain(
      "旅行しおりユーアールエルをSlackに投稿しました。",
    );
    expect(body.result.content[0].text).not.toContain("valid-token");
  });
});
