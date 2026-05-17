import type { Tool } from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";

/**
 * persona_render Tool — Phase 3 Bedrock Tool Use schema (Claude Haiku)
 *
 * Converts rawChatMessage to Saboru persona tone.
 * Uses forced tool choice for structured output.
 *
 * Model: anthropic.claude-haiku-3-5-20241022-v1:0 (cost-optimized)
 * maxTokens: 256 (tone conversion is short)
 * temperature: 0.3 (slight creativity for natural tone)
 */

export const PERSONA_RENDER_TOOL_NAME = "persona_render";

export const PERSONA_RENDER_TOOL: Tool = {
  toolSpec: {
    name: PERSONA_RENDER_TOOL_NAME,
    description:
      "rawChatMessage をサボロー口調に変換し、summaryText も口調を揃えて返す",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          summaryText: {
            type: "string",
            description: "口調変換済みの1行サマリ（60文字以内）",
            maxLength: 60,
          },
          chatMessage: {
            type: "string",
            description:
              "サボロー口調に変換済みの150文字以内チャットメッセージ。語尾は〜だよ/〜ね/〜かな。絵文字を1〜2個含む",
            maxLength: 200,
          },
        },
        required: ["summaryText", "chatMessage"],
      },
    },
  },
};

/**
 * Zod schema for validating persona_render tool output
 */
export const RenderOutputSchema = z.object({
  summaryText: z.string().min(1).max(120),
  chatMessage: z.string().min(1).max(300),
});

/**
 * SABORU_OTTORI_SYSTEM_PROMPT — Phase 3 system prompt for persona tone conversion
 *
 * Saboru ottori persona: gentle, reassuring, encouraging user to rest without guilt
 */
export const SABORU_OTTORI_SYSTEM_PROMPT = `あなたはサボローです。おっとりした口調で、ユーザーが罪悪感なくサボれるよう優しく背中を押します。
以下のルールを守ってください:
- 語尾は「〜だよ」「〜ね」「〜かな」を使う
- 絵文字を自然に1〜2個使う
- chatMessage は150文字以内に収める
- 判定根拠を1〜2文で優しく説明する
- 「can_saboru」なら背中を押す。「must_do」なら優しく現実を伝える`;

/**
 * Verdict metadata mapping for PersonaRenderer output enrichment
 */
export const VERDICT_META: Record<string, { emoji: string; label: string }> = {
  can_saboru: { emoji: "😴", label: "今はサボっていいよ" },
  borderline: { emoji: "🤔", label: "グレーゾーンだよ" },
  must_do: { emoji: "⚡", label: "やった方がいいかな" },
};
