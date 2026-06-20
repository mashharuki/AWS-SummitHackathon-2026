import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import { createTravelRoute } from "../../routes/travel.js";
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
