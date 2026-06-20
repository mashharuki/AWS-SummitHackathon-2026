import { SlackApiError } from "@saboru/agent";
import { describe, expect, it } from "vitest";
import type {
  TravelPlanAndPostToSlackRequest,
  TravelPlanResponse,
} from "../../travel/schemas.js";
import { TravelPlanSlackPostService } from "../../travel/TravelPlanSlackPostService.js";

describe("TravelPlanSlackPostService", () => {
  it("posts formatted Slack markdown with the user token when available", async () => {
    const captured: Array<{
      token: string;
      input: { channel: string; text: string; thread_ts?: string };
    }> = [];
    const service = new TravelPlanSlackPostService(
      { plan: async () => plannedResponse },
      {
        getUserToken: async () => "xoxp-user",
        getToken: async () => "xoxb-bot",
        createSlackClient: (token) => ({
          postMessage: async (input) => {
            captured.push({ token, input });
            return { ts: "1718600000.123456" };
          },
        }),
      },
    );

    const result = await service.planAndPostToSlack({
      userId: "user-123",
      request: {
        origin: "Tokyo",
        destination: "Paris",
        departureDate: "2026-07-10",
        returnDate: "2026-07-15",
        travelers: 1,
        currency: "JPY",
        interests: ["food"],
        flightPreference: "balanced",
        hotelPreference: "standard",
        language: "ja",
        channelId: "C12345",
        threadTs: "1718500000.111111",
        approved: true,
      },
    });

    expect(result).toMatchObject({
      status: "posted",
      slack: {
        posted: true,
        channelId: "C12345",
        ts: "1718600000.123456",
        threadTs: "1718500000.111111",
      },
    });
    expect(captured).toHaveLength(1);
    expect(captured[0]?.token).toBe("xoxp-user");
    expect(captured[0]?.input).toMatchObject({
      channel: "C12345",
      thread_ts: "1718500000.111111",
    });
    expect(captured[0]?.input.text).toContain("*SABOROU旅行プラン*");
    expect(captured[0]?.input.text).toContain("Paris &amp; Lyon");
    expect(captured[0]?.input.text).toContain("Central &lt;Hotel&gt;");
    expect(captured[0]?.input.text).toContain(
      "<https://example.com/book?x=1&y=2|予約リンク>",
    );
    expect(captured[0]?.input.text.length).toBeLessThanOrEqual(4000);
    expect(captured[0]?.input.text).not.toContain("api-token-secret");
    expect(captured[0]?.input.text).not.toContain("marker-secret");
    expect(captured[0]?.input.text).not.toContain("trs-secret");
    expect(captured[0]?.input.text).not.toContain("Bearer ");
  });

  it("falls back to the bot token when no user token is configured", async () => {
    let tokenUsed = "";
    const service = new TravelPlanSlackPostService(
      { plan: async () => plannedResponse },
      {
        getUserToken: async () => null,
        getToken: async () => "xoxb-bot",
        createSlackClient: (token) => ({
          postMessage: async () => {
            tokenUsed = token;
            return { ts: "1718600000.123456" };
          },
        }),
      },
    );

    await service.planAndPostToSlack({
      userId: "user-123",
      request: approvedRequest(),
    });

    expect(tokenUsed).toBe("xoxb-bot");
  });

  it("maps Slack API failures to a safe 502 AppError", async () => {
    const service = new TravelPlanSlackPostService(
      { plan: async () => plannedResponse },
      {
        getUserToken: async () => null,
        getToken: async () => "xoxb-bot",
        createSlackClient: () => ({
          postMessage: async () => {
            throw new SlackApiError("channel_not_found", "chat.postMessage");
          },
        }),
      },
    );

    await expect(
      service.planAndPostToSlack({
        userId: "user-123",
        request: approvedRequest(),
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "SLACK_API_ERROR",
    });
  });
});

const plannedResponse: TravelPlanResponse = {
  status: "planned",
  message: "パリ旅行を組みました。",
  missingFields: [],
  sourceMode: "fixture",
  plan: {
    summary: "Paris & Lyon <special> trip",
    assumptions: ["価格はデモ候補です。"],
    flights: [
      {
        rank: 1,
        title: "NRT > CDG balanced",
        price: { amount: 120000, currency: "JPY" },
        reason:
          "乗継と価格のバランスが良いです。api-token-secret marker-secret trs-secret Bearer hidden",
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

function approvedRequest(): TravelPlanAndPostToSlackRequest {
  return {
    origin: "Tokyo",
    destination: "Paris",
    departureDate: "2026-07-10",
    returnDate: "2026-07-15",
    travelers: 1,
    currency: "JPY",
    interests: ["food"],
    flightPreference: "balanced",
    hotelPreference: "standard",
    language: "ja",
    channelId: "C12345",
    approved: true,
  };
}
