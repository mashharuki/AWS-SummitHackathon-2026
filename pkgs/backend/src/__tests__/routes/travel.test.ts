import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import { createTravelRoute } from "../../routes/travel.js";
import { TravelPlanSlackPostService } from "../../travel/TravelPlanSlackPostService.js";
import type { TravelPlanResponse } from "../../travel/schemas.js";

describe("POST /api/travel/plan", () => {
  it("requires authentication", async () => {
    const app = new Hono();
    app.route(
      "/api/travel",
      createTravelRoute({
        plan: async () => {
          throw new Error("should not be called");
        },
        planAndPostToSlack: async () => {
          throw new Error("should not be called");
        },
      }),
    );
    app.onError(errorHandler);

    const res = await app.request("/api/travel/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: "Paris" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns planned travel response for an authenticated caller", async () => {
    const planned: TravelPlanResponse = {
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
    };
    const app = new Hono();
    app.route(
      "/api/travel",
      createTravelRoute({
        plan: async () => planned,
        planAndPostToSlack: async () => {
          throw new Error("should not be called");
        },
      }),
    );

    const res = await app.request("/api/travel/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-sub": "user-123",
      },
      body: JSON.stringify({
        destination: "Paris",
        departureDate: "2026-07-10",
        returnDate: "2026-07-15",
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(planned);
  });

  it("rejects unknown fields", async () => {
    const app = new Hono();
    app.route(
      "/api/travel",
      createTravelRoute({
        plan: async () => {
          throw new Error("should not be called");
        },
        planAndPostToSlack: async () => {
          throw new Error("should not be called");
        },
      }),
    );

    const res = await app.request("/api/travel/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-sub": "user-123",
      },
      body: JSON.stringify({
        destination: "Paris",
        departureDate: "2026-07-10",
        returnDate: "2026-07-15",
        admin: true,
      }),
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/travel/plan-and-post-to-slack", () => {
  it("rejects missing approval before planning or Slack posting", async () => {
    const app = new Hono();
    app.route(
      "/api/travel",
      createTravelRoute(
        createPlanAndPostService({
          plan: async () => {
            throw new Error("should not plan without approval");
          },
        }),
      ),
    );
    app.onError(errorHandler);

    const res = await app.request("/api/travel/plan-and-post-to-slack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-sub": "user-123",
      },
      body: JSON.stringify({
        destination: "Paris",
        departureDate: "2026-07-10",
        returnDate: "2026-07-15",
        channelId: "C12345",
      }),
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("returns clarification without Slack posting when required travel fields are missing", async () => {
    const app = new Hono();
    const service = createPlanAndPostService({
      plan: async () => clarificationResponse,
      createSlackClient: () => ({
        postMessage: async () => {
          throw new Error("should not post when clarification is needed");
        },
      }),
    });
    app.route("/api/travel", createTravelRoute(service));

    const res = await app.request("/api/travel/plan-and-post-to-slack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-sub": "user-123",
      },
      body: JSON.stringify({
        channelId: "C12345",
        approved: true,
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "needs_clarification",
      message: clarificationResponse.message,
      missingFields: ["destination", "departureDate", "returnDate"],
    });
  });
});

const clarificationResponse: TravelPlanResponse = {
  status: "needs_clarification",
  message: "旅行プランを作るために、行き先、出発日、帰国日を教えてください。",
  missingFields: ["destination", "departureDate", "returnDate"],
  sourceMode: "fixture",
  plan: {
    summary: "旅行プラン作成に必要な条件が不足しています。",
    assumptions: [],
    flights: [],
    hotels: [],
    activitiesByDay: [],
    nextQuestion: "旅行プランを作るために、行き先、出発日、帰国日を教えてください。",
  },
};

function createPlanAndPostService(options: {
  plan: (input: unknown) => Promise<TravelPlanResponse>;
  getToken?: (userId: string) => Promise<string>;
  getUserToken?: (userId: string) => Promise<string | null>;
  createSlackClient?: (token: string) => {
    postMessage(input: {
      channel: string;
      text: string;
      thread_ts?: string;
    }): Promise<{ ts?: string }>;
  };
}) {
  const postService = new TravelPlanSlackPostService(
    { plan: options.plan },
    {
      getToken: options.getToken ?? (async () => "xoxb-fallback"),
      getUserToken: options.getUserToken ?? (async () => null),
      createSlackClient:
        options.createSlackClient ??
        (() => ({ postMessage: async () => ({ ts: "1718600000.123456" }) })),
    },
  );

  return {
    plan: options.plan,
    planAndPostToSlack: (
      input: Parameters<typeof postService.planAndPostToSlack>[0],
    ) => postService.planAndPostToSlack(input),
  };
}
