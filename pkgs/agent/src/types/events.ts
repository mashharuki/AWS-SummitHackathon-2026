import { z } from "zod";

/**
 * EventBridge カスタムバス経由で転送される Slack メッセージペイロード
 * (DP-03: Zod 二重バリデーション — 入力側)
 *
 * EventBridge detail スキーマ:
 * {
 *   source: "slack",
 *   userId: "<cognitoSub>",   // WebhookHandler が Slack user_id から変換
 *   message: { ... }
 * }
 *
 * プライバシー: userId は Cognito sub (内部識別子) であり、生の Slack user_id ではない。
 */
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
