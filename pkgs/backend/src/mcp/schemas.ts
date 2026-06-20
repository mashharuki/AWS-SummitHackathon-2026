import { z } from "zod";
import {
  TravelPlanAndPostToSlackRequestSchema,
  TravelPlanRequestSchema,
} from "../travel/schemas.js";
import type { McpToolName } from "./types.js";

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9:_./-]+$/);

const slackChannelSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/);

const slackThreadTsSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[0-9]{10,}\.[0-9]{1,}$/)
  .optional();

const safeTextSchema = z.string().trim().min(1).max(4000);

export const mcpToolInputSchemas = {
  saborou_list_tasks: z
    .object({
      status: z.enum(["active", "completed", "pending"]).optional(),
    })
    .strict(),
  saborou_get_task: z
    .object({
      taskId: idSchema,
    })
    .strict(),
  saborou_list_candidates: z.object({}).strict(),
  saborou_generate_reply_draft: z
    .object({
      taskId: idSchema,
      mode: z
        .enum(["sabori_judgment", "reply_draft", "decline_draft"])
        .default("reply_draft"),
    })
    .strict(),
  saborou_judge_sabori: z
    .object({
      message: safeTextSchema,
      senderName: z.string().trim().max(120).optional(),
    })
    .strict(),
  saborou_fetch_google_calendar: z.object({}).strict(),
  saborou_fetch_gmail: z
    .object({
      maxResults: z.number().int().min(1).max(20).optional(),
    })
    .strict(),
  saborou_send_slack_reply: z
    .object({
      taskId: idSchema.optional(),
      replyText: safeTextSchema.max(2000),
      channelId: slackChannelSchema,
      threadTs: slackThreadTsSchema,
    })
    .strict(),
  saborou_schedule_report: z
    .object({
      taskId: idSchema,
      tone: z.enum(["formal", "polite", "casual"]).optional(),
    })
    .strict(),
  saborou_find_task: z
    .object({
      keyword: z.string().trim().min(1).max(200),
    })
    .strict(),
  saborou_delegate_to_claude: z
    .object({
      taskId: idSchema,
      channelId: slackChannelSchema.optional(),
      threadTs: slackThreadTsSchema,
      instruction: safeTextSchema.max(2000),
    })
    .strict(),
  saborou_plan_trip: TravelPlanRequestSchema,
  saborou_plan_trip_and_post_to_slack: TravelPlanAndPostToSlackRequestSchema,
} satisfies Record<McpToolName, z.ZodTypeAny>;

export const mcpToolOutputSchemas = {
  safe_summary: z
    .object({
      status: z.string().max(80),
      message: z.string().max(1000).optional(),
    })
    .passthrough(),
  safe_action_result: z
    .object({
      status: z.string().max(80),
      message: z.string().max(1000).optional(),
      approved: z.boolean().optional(),
    })
    .passthrough(),
};

export type McpParsedToolArgs<TName extends McpToolName> = z.infer<
  (typeof mcpToolInputSchemas)[TName]
>;

export function parseMcpToolArgs(
  toolName: McpToolName,
  args: Record<string, unknown>,
): Record<string, unknown> {
  return mcpToolInputSchemas[toolName].parse(args) as Record<string, unknown>;
}

export function getMcpInputSchema(toolName: McpToolName): z.ZodTypeAny {
  return mcpToolInputSchemas[toolName];
}
