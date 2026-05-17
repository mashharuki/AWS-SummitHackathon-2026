import { z } from "zod";

/**
 * 本音データ記録リクエストのバリデーション
 * POST /api/tasks/:id/honne のリクエストボディバリデーションに使用
 *
 * バリデーションルール:
 * - quick_reply タイプ: content は 4 種類の固定 QuickReplyType 値のいずれか (BR-10)
 * - free_text タイプ: content は 1〜500 文字の文字列
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
