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
import { formatTravelPlanForSlack, previewSlackText } from "./slackMarkdown.js";
import type { TravelPlanningService } from "./TravelPlanningService.js";

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
};

export class TravelPlanSlackPostService {
  private readonly getToken: (userId: string) => Promise<string>;
  private readonly getUserToken: (userId: string) => Promise<string | null>;
  private readonly createSlackClient: (token: string) => SlackPostClient;

  constructor(
    private readonly travelPlanningService: Pick<TravelPlanningService, "plan">,
    options: TravelPlanSlackPostServiceOptions = {},
  ) {
    this.getToken = options.getToken ?? getSlackToken;
    this.getUserToken = options.getUserToken ?? getSlackUserToken;
    this.createSlackClient =
      options.createSlackClient ?? ((token) => new SlackClient(token));
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

    const text = formatTravelPlanForSlack(planResponse);
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
        message: "旅行プランをSlackに投稿しました。",
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
