import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createMcpJsonRpcRoute } from "../../routes/mcp-jsonrpc.js";

const verifier = async () => ({
  sub: "user-123",
  iss: "issuer",
  aud: "audience",
});

describe("POST /api/mcp JSON-RPC", () => {
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
});
