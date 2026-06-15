import type { Tool } from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";

/**
 * reply_draft Tool — v2 返信文生成 Bedrock Tool Use スキーマ (AG-V2-01)
 *
 * Slack メッセージ文脈とタスク状況から、丁寧なビジネス日本語の
 * 返信文ドラフトを生成する。toolChoice.tool による強制ツール呼び出しで
 * 構造化出力を保証する。
 *
 * 設計: DP-02 (toolChoice.tool 強制), DP-03 (Zod バリデーション)
 * saboriJudgmentTool.ts の作法に厳密に倣う。
 */

export const REPLY_DRAFT_TOOL_NAME = "reply_draft";

export const REPLY_DRAFT_TOOL: Tool = {
  toolSpec: {
    name: REPLY_DRAFT_TOOL_NAME,
    description:
      "Slack メッセージ文脈とタスク状況を分析し、丁寧なビジネス日本語の返信文ドラフトを生成して構造化データを返す",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          replyText: {
            type: "string",
            description: [
              "Slack に送る返信文ドラフト。丁寧なビジネス日本語で書く。",
              "敬語を基調とし、相手への配慮を含める。挨拶〜本文〜結びの構成。",
              "300文字以内。署名や宛名（@メンション）は含めない。",
            ].join("\n"),
            maxLength: 300,
          },
          tone: {
            type: "string",
            enum: ["formal", "polite", "casual"],
            description: [
              "返信文のトーン。",
              "formal: 社外・目上向けの最も丁寧な敬語",
              "polite: 社内同僚向けの標準的な丁寧語（デフォルト推奨）",
              "casual: 親しい相手向けのややくだけた丁寧語",
            ].join("\n"),
          },
          reasoning: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
            description:
              "この返信文を生成した根拠。各項目は具体的な文脈事実に基づく文章",
          },
        },
        required: ["replyText", "reasoning"],
      },
    },
  },
};

/**
 * reply_draft ツール出力を検証する Zod スキーマ (DP-03)
 */
export const ReplyDraftSchema = z.object({
  replyText: z.string().min(1).max(400),
  tone: z.enum(["formal", "polite", "casual"]).optional(),
  reasoning: z.array(z.string()).min(1).max(10),
});

export type ReplyDraft = z.infer<typeof ReplyDraftSchema>;

/**
 * REPLY_DRAFT_SYSTEM_PROMPT — v2 返信文生成のシステムプロンプト
 *
 * ビジネス日本語の作法に沿って、相手に失礼のない返信文を生成する。
 */
export const REPLY_DRAFT_SYSTEM_PROMPT = `あなたはビジネスコミュニケーションの専門家です。
Slack で受け取ったメッセージとユーザーのタスク状況をもとに、相手へ送る返信文のドラフトを生成します。

## 返信文の方針
- 丁寧なビジネス日本語で書く。敬語を基調とし、相手への配慮を忘れない
- 相手の依頼・質問の意図を正確に汲み取り、過不足なく応える
- タスクの進捗状況がある場合は、現状と見通しを具体的に伝える
- 曖昧な約束や誇張を避け、確実に守れる範囲で回答する
- 構成は「軽い挨拶 → 本文（用件への返答）→ 結び」を基本とする
- 300文字以内に簡潔にまとめる

## トーンの選択
- 相手が社外・目上であれば formal
- 社内の同僚であれば polite（迷ったらこれを選ぶ）
- 親しい間柄が明確なら casual

## 禁止事項
- 宛名（@メンション）や署名は本文に含めない
- 不確実な情報を断定しない
- ネガティブな印象を与える表現を避ける`;
