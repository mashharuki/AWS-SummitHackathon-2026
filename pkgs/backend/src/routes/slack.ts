/**
 * Slack 連携ルート（Bot Token を能動的に使う操作）
 *
 * POST /api/slack/sync-messages — 認証ユーザーの Slack チャンネル履歴を遡及取得し、
 *   各メッセージを EventBridge (SlackBackfill) に publish して TaskExtractor で
 *   タスク候補化する。「Slack からタスク一覧を取得する」ユーザー要望に対応。
 *
 * POST /api/slack/notify-task — タスクのサボり判定を Slack チャンネル/スレッドに
 *   投稿する（chat.postMessage）。「Bot Token でインタラクティブなやり取り」に対応。
 *
 * 設計:
 * - 認証ユーザー（cognitoSub）の per-user Bot Token を Secrets Manager から取得
 * - conversations.history を呼び、ボット/サブタイプ/空メッセージを除外
 * - 各メッセージを SlackBackfill イベントとして publish（userId を直接保持＝逆引き不要）
 */

import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { zValidator } from "@hono/zod-validator";
import { SlackClient, getSlackToken } from "@saboru/agent";
import { Hono } from "hono";
import { z } from "zod";
import { env } from "../config/env.js";
import { NotFoundError } from "../errors.js";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoProposalRepository } from "../repositories/DynamoProposalRepository.js";
import type { DynamoTaskRepository } from "../repositories/DynamoTaskRepository.js";
import type { AppEnv } from "../types.js";

const SyncMessagesSchema = z.object({
  channelId: z.string().min(1),
  /** Unix epoch（秒）。これより新しいメッセージのみ取り込む */
  oldest: z.string().optional(),
  /** 取り込む最大件数（1〜200） */
  limit: z.number().int().min(1).max(200).optional(),
});

const NotifyTaskSchema = z.object({
  taskId: z.string().min(1),
  channelId: z.string().min(1),
  /** スレッド返信にする場合の親メッセージ ts */
  threadTs: z.string().optional(),
});

/** verdict をサボロー口調の一言メッセージにする */
function verdictToMessage(verdict: string, title: string): string {
  switch (verdict) {
    case "can_saboru":
      return `😴「${title}」は今サボってもよさそうだよ〜`;
    case "borderline":
      return `🤔「${title}」は微妙なライン。様子見かな`;
    case "must_do":
      return `⚡「${title}」はそろそろやった方がいいかも！`;
    default:
      return `「${title}」の判定が出たよ`;
  }
}

export function createSlackRoute(
  taskRepository: DynamoTaskRepository,
  proposalRepository: DynamoProposalRepository,
  ebClient: EventBridgeClient = new EventBridgeClient({
    region: process.env.AWS_REGION ?? "ap-northeast-1",
  }),
): Hono<AppEnv> {
  const slack = new Hono<AppEnv>();
  slack.use("*", authMiddleware);

  /** GET /api/slack/channels — Bot が参加しているチャンネル一覧（UI のドロップダウン用） */
  slack.get("/channels", async (c) => {
    const userId = c.get("userId");
    const botToken = await getSlackToken(userId);
    const client = new SlackClient(botToken);
    const channels = await client.conversationsList();
    return c.json({
      channels: channels.map((ch) => ({ id: ch.id, name: ch.name })),
    });
  });

  /** POST /api/slack/sync-messages — Slack 履歴を遡及取得してタスク化キューへ投入 */
  slack.post(
    "/sync-messages",
    zValidator("json", SyncMessagesSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request body",
              details: result.error.flatten(),
            },
          },
          400,
        );
      }
    }),
    async (c) => {
      const userId = c.get("userId");
      const { channelId, oldest, limit } = c.req.valid("json");

      // per-user Bot Token を取得（未連携なら Secrets Manager が失敗 → 500）
      const botToken = await getSlackToken(userId);
      const client = new SlackClient(botToken);

      const messages = await client.conversationsHistory({
        channel: channelId,
        ...(oldest ? { oldest } : {}),
        ...(limit ? { limit } : {}),
      });

      // ボット・サブタイプ・空テキストを除外
      const taskable = messages.filter(
        (m) => !m.bot_id && !m.subtype && m.text && m.text.trim().length > 0,
      );

      // 各メッセージを SlackBackfill イベントとして publish
      const entries = taskable.map((m) => ({
        Source: "saborou.backend",
        DetailType: "SlackBackfill",
        Detail: JSON.stringify({
          userId,
          message: {
            text: m.text,
            channel: channelId,
            ts: m.ts,
            ...(m.thread_ts ? { thread_ts: m.thread_ts } : {}),
            user: m.user ?? "",
          },
          receivedAt: new Date().toISOString(),
        }),
        EventBusName: env.EVENT_BUS_NAME,
      }));

      let queued = 0;
      if (entries.length > 0) {
        // EventBridge PutEvents は1リクエスト最大10件
        for (let i = 0; i < entries.length; i += 10) {
          const batch = entries.slice(i, i + 10);
          const result = await ebClient.send(
            new PutEventsCommand({ Entries: batch }),
          );
          queued += batch.length - (result.FailedEntryCount ?? 0);
        }
      }

      return c.json({ scanned: messages.length, queued });
    },
  );

  /** POST /api/slack/notify-task — タスクのサボり判定を Slack に投稿（chat.postMessage） */
  slack.post(
    "/notify-task",
    zValidator("json", NotifyTaskSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request body",
              details: result.error.flatten(),
            },
          },
          400,
        );
      }
    }),
    async (c) => {
      const userId = c.get("userId");
      const { taskId, channelId, threadTs } = c.req.valid("json");

      // タスクの所有者確認（他人のタスクは投稿させない）
      const task = await taskRepository.findById(userId, taskId);
      if (!task) throw new NotFoundError(`Task ${taskId} not found`);

      // 最新のサボり判定を取得
      const proposal = await proposalRepository.findLatestByTaskId(taskId);
      const verdict = proposal?.verdict ?? "borderline";

      const botToken = await getSlackToken(userId);
      const client = new SlackClient(botToken);
      const result = await client.postMessage({
        channel: channelId,
        text: verdictToMessage(verdict, task.title),
        ...(threadTs ? { thread_ts: threadTs } : {}),
      });

      return c.json({ posted: true, ts: result.ts, verdict });
    },
  );

  return slack;
}
