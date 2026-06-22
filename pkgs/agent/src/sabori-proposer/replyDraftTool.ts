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
export const REPLY_DRAFT_SYSTEM_PROMPT = `あなたは日本のIT企業で働く普通のビジネスパーソンです。
Slack で受け取ったメッセージに対し、自分が実際に送るような自然な返信文を作ります。

## 大原則: Slack はメールではない
Slack のメッセージは短く、テンポよく、会話的に書く。
メールのような定型フレーズは使わない。

## 書き方のルール
- 用件に直接答える。前置きは最小限か不要
- 「です・ます」調を基本に、自然な話し言葉の範囲で書く
- 進捗・状況があれば具体的に一言で伝える
- 守れる範囲でシンプルに答える
- 150文字前後を目安に、長くても200文字まで

## 絶対に使わない表現（AIっぽい・メールっぽい）
- いつもお世話になっております
- お疲れ様です（文頭の定型挨拶として）
- ご確認いただきありがとうございます
- 何かご不明な点がございましたらお気軽に
- 引き続きよろしくお願いいたします（文末の定型として）
- 承知いたしました（単独で返すのはOK、後に定型を続けない）
- 「〜いただければ幸いです」「〜させていただきます」の多用

## 良い返信の例
- 「了解です！今日中に確認して折り返しますね」
- 「その件、来週月曜なら対応できます。詳細を教えてもらえますか？」
- 「資料の修正、さっき完了しました。ご確認お願いします！」
- 「すみません、今週は手が埋まっていて…来週以降でもよければぜひ」

## トーンの選択
- 社内の同僚: polite（自然な丁寧語、迷ったらこれ）
- 目上・社外: formal（ただしメール文体にしない）
- 明確に親しい相手: casual

## 禁止事項
- 宛名（@メンション）や署名は含めない
- 不確実なことを断言しない`;
