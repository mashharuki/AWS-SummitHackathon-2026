import {
  SlackApiError,
  SlackClient,
  getSlackToken,
  getSlackUserToken,
} from "@saboru/agent";
import type { Task } from "@saboru/shared";
import { AppError, ForbiddenError } from "../errors.js";
import {
  type MarpCreateSlidesAndPostToSlackRequest,
  type MarpCreateSlidesAndPostToSlackResponse,
  MarpCreateSlidesAndPostToSlackResponseSchema,
  type MarpCreateSlidesRequest,
} from "./schemas.js";
import type { MarpSlideService } from "./MarpSlideService.js";

type SlackPostClient = {
  postMessage(input: {
    channel: string;
    text: string;
    thread_ts?: string;
  }): Promise<{ ts?: string }>;
};

type TaskRepository = {
  findApprovedByUserId(userId: string): Promise<Task[]>;
};

export type MarpSlideSlackPostServiceOptions = {
  getToken?: (userId: string) => Promise<string>;
  getUserToken?: (userId: string) => Promise<string | null>;
  createSlackClient?: (token: string) => SlackPostClient;
  taskRepository?: TaskRepository;
};

export class MarpSlideSlackPostService {
  private readonly getToken: (userId: string) => Promise<string>;
  private readonly getUserToken: (userId: string) => Promise<string | null>;
  private readonly createSlackClient: (token: string) => SlackPostClient;
  private readonly taskRepository?: TaskRepository;

  constructor(
    private readonly marpSlideService: Pick<MarpSlideService, "createSlides">,
    options: MarpSlideSlackPostServiceOptions = {},
  ) {
    this.getToken = options.getToken ?? getSlackToken;
    this.getUserToken = options.getUserToken ?? getSlackUserToken;
    this.createSlackClient =
      options.createSlackClient ?? ((token) => new SlackClient(token));
    this.taskRepository = options.taskRepository;
  }

  async createSlidesAndPostToSlack(input: {
    userId: string;
    request: MarpCreateSlidesAndPostToSlackRequest;
  }): Promise<MarpCreateSlidesAndPostToSlackResponse> {
    if (input.request.approved !== true) {
      throw new ForbiddenError("Marp slide Slack posting requires approval");
    }

    const resolvedChannelId = await this.resolveChannelId(
      input.userId,
      input.request.channelId,
    );
    if (!resolvedChannelId) {
      throw new AppError(
        400,
        "MISSING_CHANNEL",
        "channelId が指定されておらず、タスク履歴からも取得できませんでした。channelId を指定してください。",
      );
    }

    const response = await this.marpSlideService.createSlides(
      toMarpCreateSlidesRequest(input.request),
    );

    if (response.status === "error") {
      throw new AppError(500, "TOOL_ERROR", response.message);
    }

    const { topic, slideUrl } = response;

    const text = slideUrl
      ? `*${topic}* のMarpスライドを作成しました！\n<${slideUrl}|スライドを見る>（7日間有効）`
      : `*${topic}* のMarpスライドを作成しました。スライドURLが生成できませんでした。`;

    const userToken = await this.getUserToken(input.userId);
    const token = userToken ?? (await this.getToken(input.userId));
    const client = this.createSlackClient(token);

    console.log(`[MarpSlideSlackPostService] posting to Slack channelId=${resolvedChannelId}`);
    try {
      const result = await client.postMessage({
        channel: resolvedChannelId,
        text,
        ...(input.request.threadTs
          ? { thread_ts: input.request.threadTs }
          : {}),
      });

      console.log(`[MarpSlideSlackPostService] Slack post success ts=${result.ts}`);
      return MarpCreateSlidesAndPostToSlackResponseSchema.parse({
        status: "posted",
        message: "MarpスライドをSlackに投稿しました。",
        slideUrl: response.slideUrl,
        topic: response.topic,
        slideCount: response.slideCount,
        slack: {
          posted: true,
          channelId: resolvedChannelId,
          ...(result.ts ? { ts: result.ts } : {}),
          ...(input.request.threadTs
            ? { threadTs: input.request.threadTs }
            : {}),
          textPreview: text.slice(0, 100),
        },
      });
    } catch (error) {
      console.log(`[MarpSlideSlackPostService] Slack post error channelId=${resolvedChannelId} error=${(error as Error)?.message}`);
      if (error instanceof SlackApiError) {
        throw new AppError(
          502,
          "SLACK_API_ERROR",
          `Slackへのスライド投稿に失敗しました: ${(error as Error)?.message}`,
        );
      }
      throw error;
    }
  }

  private async resolveChannelId(
    userId: string,
    channelId: string | undefined,
  ): Promise<string | undefined> {
    if (channelId) return channelId;
    if (!this.taskRepository) return undefined;
    const tasks = await this.taskRepository.findApprovedByUserId(userId);
    const taskWithChannel = tasks.find(
      (t) => (t as { slackChannelId?: string }).slackChannelId,
    );
    return (taskWithChannel as { slackChannelId?: string } | undefined)
      ?.slackChannelId;
  }
}

function toMarpCreateSlidesRequest(
  request: MarpCreateSlidesAndPostToSlackRequest,
): MarpCreateSlidesRequest {
  const { channelId: _c, threadTs: _t, approved: _a, ...rest } = request;
  return rest;
}
