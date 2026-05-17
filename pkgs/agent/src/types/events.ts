import { z } from "zod";

/**
 * Slack message payload forwarded via EventBridge custom bus
 * (DP-03: Zod double validation — input side)
 *
 * EventBridge detail schema:
 * {
 *   source: "slack",
 *   userId: "<cognitoSub>",   // Mapped by WebhookHandler from Slack user_id
 *   message: { ... }
 * }
 *
 * Privacy: userId is the Cognito sub (internal), not the raw Slack user_id.
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
