import { describe, expect, it } from "vitest";
import { renderTravelItineraryHtml } from "../../travel/travelItineraryHtml.js";
import type { TravelPlanResponse } from "../../travel/schemas.js";

describe("renderTravelItineraryHtml", () => {
  it("renders escaped styled HTML and redacts credential-like text", () => {
    const html = renderTravelItineraryHtml(plannedResponse);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<style>");
    expect(html).toContain("Paris &amp; Lyon &lt;trip&gt;");
    expect(html).toContain("Central &lt;Hotel&gt;");
    expect(html).toContain("https://example.com/book?x=1&amp;y=2");
    expect(html).not.toContain("api-token-secret");
    expect(html).not.toContain("marker-secret");
    expect(html).not.toContain("Bearer hidden");
  });

  it("drops non-http booking links", () => {
    const html = renderTravelItineraryHtml({
      ...plannedResponse,
      plan: {
        ...plannedResponse.plan,
        flights: [
          {
            ...plannedResponse.plan.flights[0]!,
            bookingUrl: "javascript:alert(1)",
          },
        ],
      },
    });

    expect(html).not.toContain("javascript:alert");
  });
});

const plannedResponse: TravelPlanResponse = {
  status: "planned",
  message: "パリ旅行を組みました。",
  missingFields: [],
  sourceMode: "fixture",
  plan: {
    summary: "Paris & Lyon <trip>",
    assumptions: ["価格はデモ候補です。"],
    flights: [
      {
        rank: 1,
        title: "NRT > CDG balanced",
        price: { amount: 120000, currency: "JPY" },
        reason: "api-token-secret marker-secret trs-secret Bearer hidden",
        bookingUrl: "https://example.com/book?x=1&y=2",
      },
    ],
    hotels: [
      {
        rank: 1,
        name: "Central <Hotel>",
        area: "Opera",
        reason: "観光と食事に便利です。",
        bookingUrl: "https://example.com/hotel",
      },
    ],
    activitiesByDay: [
      {
        day: 1,
        date: "2026-07-10",
        items: [
          {
            title: "街歩き",
            timeOfDay: "afternoon",
            reason: "到着日は軽めにします。",
            bookingUrl: null,
          },
        ],
      },
    ],
    nextQuestion: null,
  },
};
