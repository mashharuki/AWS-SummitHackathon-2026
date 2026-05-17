import { z } from "zod";

/**
 * Honne data recording request validation
 * Used for request body validation of POST /api/tasks/:id/honne
 *
 * Validation rules:
 * - quick_reply type: content must be one of 4 fixed QuickReplyType values (BR-10)
 * - free_text type: content must be 1-500 chars string
 */
export const CreateHonneSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("quick_reply"),
    content: z.enum([
      "truly_tired",
      "actually_important",
      "agree_with_ai",
      "disagree_with_ai",
    ]),
  }),
  z.object({
    type: z.literal("free_text"),
    content: z
      .string()
      .min(1, "フリーテキストは1文字以上必要です")
      .max(500, "本音テキストは500文字以内です"),
  }),
]);

export type CreateHonneInput = z.infer<typeof CreateHonneSchema>;
