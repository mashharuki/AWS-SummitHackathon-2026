import { describe, expect, it } from "vitest";
import { TravelPlanningService } from "../../travel/TravelPlanningService.js";
import type { TravelFlightOption } from "../../travel/schemas.js";

describe("TravelPlanningService", () => {
  it("returns clarification when destination or dates are missing", async () => {
    const service = new TravelPlanningService();

    const result = await service.plan({ destination: "Paris" });

    expect(result.status).toBe("needs_clarification");
    expect(result.missingFields).toEqual(["departureDate", "returnDate"]);
    expect(result.plan.nextQuestion).toContain("出発日");
  });

  it("returns a fixture plan without Travelpayouts credentials", async () => {
    const service = new TravelPlanningService();

    const result = await service.plan({
      destination: "Paris",
      departureDate: "2026-07-10",
      returnDate: "2026-07-15",
    });

    expect(result.status).toBe("planned");
    expect(result.sourceMode).toBe("fixture");
    expect(result.plan.flights.length).toBeGreaterThan(0);
    expect(result.plan.hotels.length).toBe(3);
    expect(result.plan.activitiesByDay.length).toBeGreaterThan(0);
  });

  it("falls back to fixture flights when Travelpayouts returns an error", async () => {
    const service = new TravelPlanningService({
      travelpayoutsClient: {
        hasCredentials: async () => true,
        getFlightPricesForDates: async () => {
          throw new Error("401");
        },
        createPartnerLinks: async () => [],
      },
    });

    const result = await service.plan({
      origin: "Tokyo",
      destination: "Paris",
      departureDate: "2026-07-10",
      returnDate: "2026-07-15",
      travelers: 1,
    });

    expect(result.status).toBe("planned");
    expect(result.sourceMode).toBe("fixture");
    expect(result.plan.flights[0]?.title).toContain("PAR");
  });

  it("marks mixed mode when live flights succeed but partner link generation fails", async () => {
    const liveFlight: TravelFlightOption = {
      rank: 1,
      title: "TYOからPARへのライブ候補",
      price: { amount: 120000, currency: "JPY" },
      reason: "live cache",
      bookingUrl: null,
    };
    const service = new TravelPlanningService({
      travelpayoutsClient: {
        hasCredentials: async () => true,
        getFlightPricesForDates: async () => [liveFlight],
        createPartnerLinks: async (urls) => urls.map(() => null),
      },
    });

    const result = await service.plan({
      destination: "Paris",
      departureDate: "2026-07-10",
      returnDate: "2026-07-15",
    });

    expect(result.status).toBe("planned");
    expect(result.sourceMode).toBe("mixed");
    expect(result.plan.flights[0]).toEqual(liveFlight);
  });

  it("does not expose Travelpayouts secrets in the response", async () => {
    const service = new TravelPlanningService({
      travelpayoutsClient: {
        hasCredentials: async () => true,
        getFlightPricesForDates: async () => {
          throw new Error("token apiToken marker trs Authorization");
        },
        createPartnerLinks: async () => ["https://example.com/safe"],
      },
    });

    const result = await service.plan({
      destination: "Paris",
      departureDate: "2026-07-10",
      returnDate: "2026-07-15",
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("apiToken");
    expect(serialized).not.toContain("marker");
    expect(serialized).not.toContain("trs");
    expect(serialized).not.toContain("Authorization");
  });
});
