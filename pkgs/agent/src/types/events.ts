import { z } from "zod";

// ---- ドメイン型 (TaskExtractorAgent が使用) ----

export const SlackMessageSchema = z.object({
  text: z.string(),
  channelId: z.string().min(1),
  threadTs: z.string().optional(),
  messageTs: z.string().min(1),
  teamId: z.string().min(1),
  userId: z.string().min(1),
});

export const SlackEventPayloadSchema = z.object({
  source: z.literal("slack"),
  userId: z.string().min(1),
  message: SlackMessageSchema,
});

export type SlackMessage = z.infer<typeof SlackMessageSchema>;
export type SlackEventPayload = z.infer<typeof SlackEventPayloadSchema>;

// ---- EventBridge エンベロープ型 (Lambda ハンドラーが受け取る生データ) ----

// Slack が送信する生イベント (event_callback の event フィールド)
export const RawSlackEventSchema = z.object({
  type: z.string(),
  subtype: z.string().optional(),
  bot_id: z.string().optional(),
  text: z.string().optional().default(""),
  user: z.string().optional().default(""),
  channel: z.string().optional().default(""),
  ts: z.string(),
  thread_ts: z.string().optional(),
  team: z.string().optional(),
});

// Webhook Lambda が EventBridge に送る detail
export const EventBridgeSlackDetailSchema = z.object({
  event: RawSlackEventSchema,
  teamId: z.string(),
  receivedAt: z.string(),
});

// Lambda が EventBridge から受け取る全体エンベロープ
export const EventBridgeSlackEventSchema = z.object({
  source: z.literal("saborou.webhook"),
  "detail-type": z.literal("SlackEvent"),
  detail: EventBridgeSlackDetailSchema,
});

export type EventBridgeSlackEvent = z.infer<typeof EventBridgeSlackEventSchema>;
