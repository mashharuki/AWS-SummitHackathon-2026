import {
  SlackApiError,
  SlackClient,
  getSlackToken,
  getSlackUserToken,
} from "@saboru/agent";
import { AppError, ForbiddenError } from "../errors.js";
import {
  type TravelPlanAndPostToSlackRequest,
  type TravelPlanAndPostToSlackResponse,
  TravelPlanAndPostToSlackResponseSchema,
  type TravelPlanRequest,
} from "./schemas.js";
import type {
  PublishedTravelItinerary,
  TravelItineraryPublisher,
} from "./TravelItineraryPublisher.js";
import type { TravelPlanningService } from "./TravelPlanningService.js";
import { renderTravelItineraryHtml } from "./travelItineraryHtml.js";

type SlackPostClient = {
  postMessage(input: {
    channel: string;
    text: string;
    thread_ts?: string;
  }): Promise<{ ts?: string }>;
};

export type TravelPlanSlackPostServiceOptions = {
  getToken?: (userId: string) => Promise<string>;
  getUserToken?: (userId: string) => Promise<string | null>;
  createSlackClient?: (token: string) => SlackPostClient;
  itineraryPublisher?: Pick<TravelItineraryPublisher, "publishHtml">;
};

export class TravelPlanSlackPostService {
  private readonly getToken: (userId: string) => Promise<string>;
  private readonly getUserToken: (userId: string) => Promise<string | null>;
  private readonly createSlackClient: (token: string) => SlackPostClient;
  private readonly itineraryPublisher:
    | Pick<TravelItineraryPublisher, "publishHtml">
    | undefined;

  constructor(
    private readonly travelPlanningService: Pick<TravelPlanningService, "plan">,
    options: TravelPlanSlackPostServiceOptions = {},
  ) {
    this.getToken = options.getToken ?? getSlackToken;
    this.getUserToken = options.getUserToken ?? getSlackUserToken;
    this.createSlackClient =
      options.createSlackClient ?? ((token) => new SlackClient(token));
    this.itineraryPublisher = options.itineraryPublisher;
  }

  async planAndPostToSlack(input: {
    userId: string;
    request: TravelPlanAndPostToSlackRequest;
  }): Promise<TravelPlanAndPostToSlackResponse> {
    if (input.request.approved !== true) {
      throw new ForbiddenError("Travel plan Slack posting requires approval");
    }

    const planResponse = await this.travelPlanningService.plan(
      toTravelPlanRequest(input.request),
    );

    if (planResponse.status === "needs_clarification") {
      return TravelPlanAndPostToSlackResponseSchema.parse({
        status: "needs_clarification",
        message: planResponse.message,
        missingFields: planResponse.missingFields,
        sourceMode: planResponse.sourceMode,
        plan: planResponse.plan,
      });
    }

    const itinerary = await this.publishItinerary(planResponse);
    const text = formatTravelPlanUrlForSlack({
      destination: input.request.destination,
      summary: planResponse.plan.summary,
      itineraryUrl: itinerary.url,
    });
    const userToken = await this.getUserToken(input.userId);
    const token = userToken ?? (await this.getToken(input.userId));
    const client = this.createSlackClient(token);

    try {
      const result = await client.postMessage({
        channel: input.request.channelId,
        text,
        ...(input.request.threadTs
          ? { thread_ts: input.request.threadTs }
          : {}),
      });

      return TravelPlanAndPostToSlackResponseSchema.parse({
        status: "posted",
        message: "旅行しおりURLをSlackに投稿しました。",
        missingFields: [],
        sourceMode: planResponse.sourceMode,
        plan: planResponse.plan,
        slack: {
          posted: true,
          channelId: input.request.channelId,
          ...(result.ts ? { ts: result.ts } : {}),
          ...(input.request.threadTs
            ? { threadTs: input.request.threadTs }
            : {}),
          textPreview: previewSlackText(text),
        },
        itinerary: {
          url: itinerary.url,
          objectKey: itinerary.objectKey,
        },
      });
    } catch (error) {
      if (error instanceof SlackApiError) {
        throw new AppError(
          502,
          "SLACK_API_ERROR",
          "Slackへの旅行プラン投稿に失敗しました",
        );
      }
      throw error;
    }
  }

  private async publishItinerary(
    planResponse: Awaited<ReturnType<TravelPlanningService["plan"]>>,
  ): Promise<PublishedTravelItinerary> {
    if (!this.itineraryPublisher) {
      throw new AppError(
        502,
        "TRAVEL_ITINERARY_PUBLISH_ERROR",
        "旅行しおりURLの生成に失敗しました",
      );
    }

    try {
      return await this.itineraryPublisher.publishHtml(
        renderTravelItineraryHtml(planResponse),
      );
    } catch {
      throw new AppError(
        502,
        "TRAVEL_ITINERARY_PUBLISH_ERROR",
        "旅行しおりURLの生成に失敗しました",
      );
    }
  }
}

function toTravelPlanRequest(
  request: TravelPlanAndPostToSlackRequest,
): TravelPlanRequest {
  const {
    channelId: _channelId,
    threadTs: _threadTs,
    approved: _approved,
    ...travelRequest
  } = request;
  return travelRequest;
}

function formatTravelPlanUrlForSlack(input: {
  destination?: string;
  summary: string;
  itineraryUrl: string;
}): string {
  const title = input.destination
    ? `${escapeSlackText(input.destination)}の旅のしおり`
    : "旅のしおり";
  return [
    `*${title}* を作成しました。`,
    escapeSlackText(input.summary),
    `<${sanitizeSlackLinkUrl(input.itineraryUrl)}|HTMLの旅のしおりを開く>`,
  ].join("\n");
}

function previewSlackText(text: string): string {
  const normalized = text.replace(/\s+/g, " ");
  if (normalized.length <= 220) return normalized;
  return `${normalized.slice(0, 200).trimEnd()} ...省略しました`;
}

function escapeSlackText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeSlackLinkUrl(url: string): string {
  return url
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/\|/g, "%7C")
    .replace(/\s/g, "%20");
}
