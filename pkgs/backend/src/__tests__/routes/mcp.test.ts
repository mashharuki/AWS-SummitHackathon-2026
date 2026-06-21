import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "../../errors.js";
import type { SafeMcpAuditEvent } from "../../mcp/types.js";
import { createMcpRoute } from "../../routes/mcp.js";
import type { TravelPlanResponse } from "../../travel/schemas.js";

function createTestApp(options: {
  verifier?: (token: string) => Promise<{
    sub: string;
    iss: string;
    aud: string;
  }>;
  events?: SafeMcpAuditEvent[];
  delegationService?: {
    delegateToClaude: (input: unknown) => Promise<{
      ok: true;
      taskId: string;
      channelId: string;
      ts: string;
      delegatedTextPreview: string;
    }>;
  };
  travelPlanningService?: {
    plan: (input: unknown) => Promise<TravelPlanResponse>;
  };
  caller?: (path: string, init: RequestInit) => Promise<Response>;
}) {
  const app = new Hono();
  app.route(
    "/api/mcp",
    createMcpRoute({
      verifier: options.verifier,
      auditWriter: (event) => options.events?.push(event),
      delegationService: options.delegationService,
      travelPlanningService: options.travelPlanningService,
      caller: options.caller,
    }),
  );
  return app;
}

const validVerifier = async () => ({
  sub: "user-123",
  iss: "issuer",
  aud: "audience",
});

describe("POST /api/mcp/tools/:toolName", () => {
  it("rejects missing bearer token and writes a safe audit event", async () => {
    const events: SafeMcpAuditEvent[] = [];
    const app = createTestApp({ events });

    const res = await app.request("/api/mcp/tools/saborou_list_tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args: {} }),
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Missing bearer token" },
    });
    expect(events[0]).toMatchObject({
      action: "mcp_tool_call",
      toolName: "saborou_list_tasks",
      userIdHash: "anonymous",
      status: "unauthorized",
    });
  });

  it("rejects unknown tools before domain dispatch", async () => {
    const events: SafeMcpAuditEvent[] = [];
    const app = createTestApp({ verifier: validVerifier, events });

    const res = await app.request("/api/mcp/tools/unknown_tool", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ args: {} }),
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "TOOL_NOT_ALLOWED", message: "Tool is not allowed" },
    });
    expect(events[0]).toMatchObject({
      status: "tool_not_allowed",
      userIdHash: expect.any(String),
    });
    expect(JSON.stringify(events[0])).not.toContain("user-123");
  });

  it("requires explicit approval for side-effect tool calls", async () => {
    const app = createTestApp({ verifier: validVerifier, events: [] });

    const res = await app.request("/api/mcp/tools/saborou_send_slack_reply", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        args: { replyText: "了解しました", channelId: "C12345" },
        approved: false,
      }),
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Tool requires explicit approval",
      },
    });
  });

  it("returns a safe success response for a registry read tool", async () => {
    const events: SafeMcpAuditEvent[] = [];
    const app = createTestApp({ verifier: validVerifier, events });

    const res = await app.request("/api/mcp/tools/saborou_list_tasks", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ args: { status: "active" } }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      toolName: "saborou_list_tasks",
      result: {
        status: "validated",
        target: {
          method: "GET",
          path: "/api/tasks",
        },
        requiresApproval: false,
        validatedArgumentKeys: ["status"],
      },
    });
    expect(JSON.stringify(body)).not.toContain("valid-token");
    expect(events[0]).toMatchObject({ status: "success" });
  });

  it("does not expose verifier internals on auth failure", async () => {
    const app = createTestApp({
      verifier: async () => {
        throw new UnauthorizedError("Invalid token audience");
      },
      events: [],
    });

    const res = await app.request("/api/mcp/tools/saborou_list_tasks", {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ args: {} }),
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Invalid token audience" },
    });
  });

  it("rejects schema-invalid registry args", async () => {
    const app = createTestApp({ verifier: validVerifier, events: [] });

    const res = await app.request("/api/mcp/tools/saborou_get_task", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ args: { taskId: "<script>" } }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Tool arguments failed schema validation",
      },
    });
  });

  it("executes the implemented Claude delegation tool", async () => {
    const delegateToClaude = async () => ({
      ok: true as const,
      taskId: "task-1",
      channelId: "C12345",
      ts: "1718600000.123456",
      delegatedTextPreview: "@Claude Please help with task-1",
    });
    const app = createTestApp({
      verifier: validVerifier,
      events: [],
      delegationService: { delegateToClaude },
    });

    const res = await app.request("/api/mcp/tools/saborou_delegate_to_claude", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        args: {
          taskId: "task-1",
          channelId: "C12345",
          instruction: "調整してください",
        },
        approved: true,
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      toolName: "saborou_delegate_to_claude",
      result: {
        status: "delegated",
        taskId: "task-1",
        channelId: "C12345",
        ts: "1718600000.123456",
      },
    });
  });

  it("executes the implemented trip planner tool", async () => {
    const app = createTestApp({
      verifier: validVerifier,
      events: [],
      travelPlanningService: {
        plan: async (input) => ({
          status: "planned",
          message: `planned ${(input as { destination?: string }).destination}`,
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
        }),
      },
    });

    const res = await app.request("/api/mcp/tools/saborou_plan_trip", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        args: {
          destination: "Paris",
          departureDate: "2026-07-10",
          returnDate: "2026-07-15",
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      toolName: "saborou_plan_trip",
      result: {
        status: "planned",
        message: "planned Paris",
      },
    });
  });

  it("requires explicit approval for the trip planner Slack post tool", async () => {
    const app = createTestApp({ verifier: validVerifier, events: [] });

    const res = await app.request(
      "/api/mcp/tools/saborou_plan_trip_and_post_to_slack",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          args: {
            destination: "Paris",
            departureDate: "2026-07-10",
            returnDate: "2026-07-15",
            channelId: "C12345",
          },
        }),
      },
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Tool requires explicit approval",
      },
    });
  });

  it("rejects unknown fields for the trip planner Slack post tool", async () => {
    const app = createTestApp({ verifier: validVerifier, events: [] });

    const res = await app.request(
      "/api/mcp/tools/saborou_plan_trip_and_post_to_slack",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          args: {
            destination: "Paris",
            departureDate: "2026-07-10",
            returnDate: "2026-07-15",
            channelId: "C12345",
            approved: true,
            apiToken: "secret",
          },
          approved: true,
        }),
      },
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Tool arguments failed schema validation",
      },
    });
  });

  it("dispatches the trip planner Slack post tool through the internal API caller", async () => {
    let captured: { path: string; init: RequestInit } | undefined;
    const app = createTestApp({
      verifier: validVerifier,
      events: [],
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
    });

    const res = await app.request(
      "/api/mcp/tools/saborou_plan_trip_and_post_to_slack",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          args: {
            destination: "Paris",
            departureDate: "2026-07-10",
            returnDate: "2026-07-15",
            channelId: "C12345",
            approved: true,
          },
          approved: true,
        }),
      },
    );

    expect(res.status).toBe(200);
    expect(captured?.path).toBe("/api/travel/plan-and-post-to-slack");
    expect(captured?.init.method).toBe("POST");
    expect(captured?.init.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-internal-sub": "user-123",
    });
    expect(captured?.init.body).toBe(
      JSON.stringify({
        origin: "Tokyo",
        destination: "Paris",
        departureDate: "2026-07-10",
        returnDate: "2026-07-15",
        travelers: 1,
        currency: "JPY",
        interests: ["sightseeing", "food", "culture"],
        flightPreference: "balanced",
        hotelPreference: "standard",
        language: "ja",
        channelId: "C12345",
        approved: true,
      }),
    );
    expect(await res.json()).toMatchObject({
      ok: true,
      toolName: "saborou_plan_trip_and_post_to_slack",
      result: {
        status: "posted",
        slack: { channelId: "C12345" },
      },
    });
  });
});
