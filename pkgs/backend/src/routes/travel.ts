import { zValidator } from "@hono/zod-validator";
import { SlackClient, getSlackToken, getSlackUserToken } from "@saboru/agent";
import type { Task } from "@saboru/shared";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";
import {
  TravelPlanAndPostToSlackRequestSchema,
  TravelPlanWithSlackSchema,
} from "../travel/schemas.js";
import type { TravelItineraryPublisher } from "../travel/TravelItineraryPublisher.js";
import type { TravelPlanSlackPostService } from "../travel/TravelPlanSlackPostService.js";
import type { TravelPlanningService } from "../travel/TravelPlanningService.js";
import { renderTravelItineraryHtml } from "../travel/travelItineraryHtml.js";

type TaskRepository = {
  findApprovedByUserId(userId: string): Promise<Task[]>;
};

function logInfo(data: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: "INFO", route: "travel", ...data }));
}

function logError(data: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: "ERROR", route: "travel", ...data }));
}

async function resolveChannelId(
  userId: string,
  taskRepository?: TaskRepository,
): Promise<string | undefined> {
  if (!taskRepository) {
    logInfo({ action: "resolve_channel_id_skip", reason: "no_task_repository" });
    return undefined;
  }
  const tasks = await taskRepository.findApprovedByUserId(userId);
  const taskWithChannel = tasks.find(
    (t) => (t as { slackChannelId?: string }).slackChannelId,
  );
  const channelId = (taskWithChannel as { slackChannelId?: string } | undefined)
    ?.slackChannelId;
  logInfo({ action: "resolve_channel_id", taskCount: tasks.length, found: !!channelId });
  return channelId;
}

function formatItineraryMessage(input: {
  destination?: string;
  summary: string;
  itineraryUrl: string;
}): string {
  const dest = input.destination
    ? `${input.destination.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}の旅のしおり`
    : "旅のしおり";
  const summary = input.summary
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeUrl = input.itineraryUrl
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/\|/g, "%7C")
    .replace(/\s/g, "%20");
  return [`*${dest}* を作成しました。`, summary, `<${safeUrl}|HTMLの旅のしおりを開く>`].join(
    "\n",
  );
}

export function createTravelRoute(
  service: Pick<TravelPlanningService, "plan"> &
    Pick<TravelPlanSlackPostService, "planAndPostToSlack">,
  itineraryPublisher?: Pick<TravelItineraryPublisher, "publishHtml">,
  taskRepository?: TaskRepository,
) {
  const travel = new Hono<AppEnv>();

  travel.use("*", authMiddleware);

  travel.post(
    "/plan",
    zValidator("json", TravelPlanWithSlackSchema),
    async (c) => {
      const { channelId, threadTs, ...planInput } = c.req.valid("json");
      const response = await service.plan(planInput);

      // 旅行プランが確定している場合はしおりHTMLを生成してURLを返す
      if (response.status === "planned" && itineraryPublisher) {
        try {
          const html = renderTravelItineraryHtml(response);
          const itinerary = await itineraryPublisher.publishHtml(html);
          logInfo({ action: "itinerary_published", url: itinerary.url });

          // channelIdが指定またはタスクから解決できる場合はSlackに自動投稿する
          const userId = c.get("userId");
          const resolvedChannelId =
            channelId ?? (await resolveChannelId(userId, taskRepository));
          logInfo({ action: "slack_post_check", requestChannelId: channelId, resolvedChannelId });
          if (resolvedChannelId) {
            try {
              const userToken = await getSlackUserToken(userId);
              const hasUserToken = !!userToken;
              const token = userToken ?? (await getSlackToken(userId));
              const client = new SlackClient(token);
              const text = formatItineraryMessage({
                destination: planInput.destination,
                summary: response.plan.summary,
                itineraryUrl: itinerary.url,
              });
              await client.postMessage({
                channel: resolvedChannelId,
                text,
                ...(threadTs ? { thread_ts: threadTs } : {}),
              });
              logInfo({ action: "slack_post_success", channel: resolvedChannelId, hasUserToken });
            } catch (err) {
              logError({ action: "slack_post_failed", channel: resolvedChannelId, error: String(err) });
            }
          } else {
            logInfo({ action: "slack_post_skip", reason: "no_channel_id" });
          }

          return c.json({ ...response, itinerary });
        } catch (err) {
          logError({ action: "itinerary_publish_failed", error: String(err) });
          // 生成失敗時はURLなしでプランのみ返す（フォールバック）
        }
      }

      return c.json(response);
    },
  );

  travel.post(
    "/plan-and-post-to-slack",
    zValidator("json", TravelPlanAndPostToSlackRequestSchema),
    async (c) => {
      const request = c.req.valid("json");
      const response = await service.planAndPostToSlack({
        userId: c.get("userId"),
        request,
      });
      return c.json(response);
    },
  );

  return travel;
}
