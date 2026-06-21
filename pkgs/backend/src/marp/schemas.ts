import { z } from "zod";

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

export const MarpCreateSlidesRequestSchema = z
  .object({
    topic: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(4000).optional(),
    audience: z.string().trim().min(1).max(120).optional(),
    slideCount: z.number().int().min(8).max(20).default(12),
    language: z.enum(["ja", "en"]).default("ja"),
    purpose: z.string().trim().min(1).max(400).optional(),
  })
  .strict();

export type MarpCreateSlidesRequest = z.infer<
  typeof MarpCreateSlidesRequestSchema
>;

export const MarpCreateSlidesResponseSchema = z
  .object({
    status: z.enum(["created", "error"]),
    message: z.string().min(1).max(1000),
    slideUrl: z.string().url().max(2000).optional(),
    topic: z.string().min(1).max(200).optional(),
    slideCount: z.number().int().min(1).optional(),
  })
  .strict();

export type MarpCreateSlidesResponse = z.infer<
  typeof MarpCreateSlidesResponseSchema
>;

export const MarpCreateSlidesAndPostToSlackRequestSchema =
  MarpCreateSlidesRequestSchema.extend({
    channelId: slackChannelSchema,
    threadTs: slackThreadTsSchema,
    approved: z.boolean().default(false),
  });

export type MarpCreateSlidesAndPostToSlackRequest = z.infer<
  typeof MarpCreateSlidesAndPostToSlackRequestSchema
>;

export const MarpCreateSlidesAndPostToSlackResponseSchema = z
  .object({
    status: z.enum(["posted", "error"]),
    message: z.string().min(1).max(1000),
    slideUrl: z.string().url().max(2000).optional(),
    topic: z.string().min(1).max(200).optional(),
    slideCount: z.number().int().min(1).optional(),
    slack: z
      .object({
        posted: z.boolean(),
        channelId: z.string().min(1).max(80),
        ts: z.string().max(64).optional(),
        threadTs: z.string().max(32).optional(),
        textPreview: z.string().max(200).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type MarpCreateSlidesAndPostToSlackResponse = z.infer<
  typeof MarpCreateSlidesAndPostToSlackResponseSchema
>;
