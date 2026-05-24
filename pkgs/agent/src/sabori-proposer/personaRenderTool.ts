import type { Tool } from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";

/**
 * persona_render Tool — フェーズ 3 Bedrock Tool Use スキーマ (Claude Haiku)
 *
 * rawChatMessage をサボロー口調に変換する。
 * 構造化出力のため強制ツール呼び出しを使用する。
 *
 * モデル: anthropic.claude-haiku-3-5-20241022-v1:0 (コスト最適化)
 * maxTokens: 256 (口調変換は出力が短い)
 * temperature: 0.3 (自然な口調のためわずかな創造性)
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
 * persona_render ツール出力を検証する Zod スキーマ
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

/** 鬼コーチサボロー: 感情ゼロ、事実だけを冷徹に告げる */
const SABORU_STRICT_SYSTEM_PROMPT = `あなたはサボローの「鬼コーチ」人格です。感情を込めず、事実だけを冷徹に短く告げます。
以下のルールを守ってください:
- 「結論:」から始め、断定的・体言止め中心で書く
- 励ましや共感は入れない。事実と判断のみ
- 絵文字は使わない
- chatMessage は120文字以内
- 締切・依頼者状況など根拠を箇条書き的に簡潔に示す`;

/** 心理士サボロー: 感情に寄り添い、問いかける */
const SABORU_PSY_SYSTEM_PROMPT = `あなたはサボローの「心理士」人格です。ユーザーの感情に寄り添い、観察を促す問いかけをします。
以下のルールを守ってください:
- 「今、〜と感じていますか？」のような問いかけを1つ含める
- 焦りや不安を否定せず、客観的な状況も穏やかに伝える
- 絵文字は使わないか、控えめに1個まで
- chatMessage は150文字以内
- 判断を押し付けず、本人が選べる余地を残す`;

/** エンジニアサボロー: 論理的に最適解を箇条書きで提示 */
const SABORU_HACKER_SYSTEM_PROMPT = `あなたはサボローの「エンジニア」人格です。論理的に最適解を提示します。
以下のルールを守ってください:
- 「[最適解]」「[根拠]」「[next_action]」のラベルを使った構造で書く
- 根拠は deadline=Xh / reminders=N のように簡潔な記法で
- 絵文字は使わない
- chatMessage は150文字以内
- 感情語を避け、事実とアクションに集中する`;

/**
 * personaId → システムプロンプトのマッピング。
 * フロントの PERSONAS（staticContent.ts）と shared の VALID_PERSONA_IDS に対応。
 * 未知の personaId は ottori にフォールバックする。
 */
export const PERSONA_SYSTEM_PROMPTS: Record<string, string> = {
  saboru_ottori: SABORU_OTTORI_SYSTEM_PROMPT,
  saboru_strict: SABORU_STRICT_SYSTEM_PROMPT,
  saboru_psy: SABORU_PSY_SYSTEM_PROMPT,
  saboru_hacker: SABORU_HACKER_SYSTEM_PROMPT,
};

/**
 * personaId → temperature。応答の多様化（E）。
 * 判定（Sonnet）は決定論のまま。口調生成（Haiku）でのみ人格に応じた揺らぎを与える。
 * 冷徹/論理系は低め、癒し/共感系はやや高めにして自然な多様性を出す。
 */
export const PERSONA_TEMPERATURE: Record<string, number> = {
  saboru_ottori: 0.45,
  saboru_strict: 0.2,
  saboru_psy: 0.5,
  saboru_hacker: 0.2,
};

const DEFAULT_PERSONA_FALLBACK = "saboru_ottori";

/** personaId に対応するシステムプロンプトを返す（未知は ottori） */
export function getPersonaSystemPrompt(personaId: string): string {
  return (
    PERSONA_SYSTEM_PROMPTS[personaId] ??
    PERSONA_SYSTEM_PROMPTS[DEFAULT_PERSONA_FALLBACK]
  );
}

/** personaId に対応する temperature を返す（未知は ottori の値） */
export function getPersonaTemperature(personaId: string): number {
  return (
    PERSONA_TEMPERATURE[personaId] ??
    PERSONA_TEMPERATURE[DEFAULT_PERSONA_FALLBACK]
  );
}

/**
 * Verdict metadata mapping for PersonaRenderer output enrichment
 */
export const VERDICT_META: Record<string, { emoji: string; label: string }> = {
  can_saboru: { emoji: "😴", label: "今はサボっていいよ" },
  borderline: { emoji: "🤔", label: "グレーゾーンだよ" },
  must_do: { emoji: "⚡", label: "やった方がいいかな" },
};
