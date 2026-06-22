import type { Tool } from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";

/**
 * decline_draft Tool — v2 断り文生成 Bedrock Tool Use スキーマ (AG-V2-02)
 *
 * 依頼内容と現在のタスク負荷から、角を立てない断り文と辞退理由を生成する。
 * toolChoice.tool による強制ツール呼び出しで構造化出力を保証する。
 *
 * 設計: DP-02 (toolChoice.tool 強制), DP-03 (Zod バリデーション)
 * saboriJudgmentTool.ts の作法に厳密に倣う。
 */

export const DECLINE_DRAFT_TOOL_NAME = "decline_draft";

export const DECLINE_DRAFT_TOOL: Tool = {
  toolSpec: {
    name: DECLINE_DRAFT_TOOL_NAME,
    description:
      "依頼内容と現在のタスク負荷を分析し、角を立てない断り文と辞退理由を生成して構造化データを返す",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          declineText: {
            type: "string",
            description: [
              "Slack に送る断り文ドラフト。丁寧で角を立てないビジネス日本語で書く。",
              "依頼への感謝 → 受けられない事情の説明 → 代替案や次回への含み、の構成。",
              "相手の心証を損なわないよう配慮する。300文字以内。宛名・署名は含めない。",
            ].join("\n"),
            maxLength: 300,
          },
          declineReason: {
            type: "string",
            description:
              "辞退の主たる理由を一文で要約。例: 「現在進行中の案件で手一杯のため」。50文字以内",
            maxLength: 50,
          },
          alternative: {
            type: "string",
            description:
              "提示できる代替案や次善策。例: 「来週以降であれば対応可能」。なければ空文字でよい",
          },
          reasoning: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
            description:
              "この断り方を選んだ根拠。各項目はタスク負荷など具体的な事実に基づく文章",
          },
        },
        required: ["declineText", "declineReason", "reasoning"],
      },
    },
  },
};

/**
 * decline_draft ツール出力を検証する Zod スキーマ (DP-03)
 */
export const DeclineDraftSchema = z.object({
  declineText: z.string().min(1).max(400),
  declineReason: z.string().min(1).max(80),
  alternative: z.string().optional(),
  reasoning: z.array(z.string()).min(1).max(10),
});

export type DeclineDraft = z.infer<typeof DeclineDraftSchema>;

/**
 * DECLINE_DRAFT_SYSTEM_PROMPT — v2 断り文生成のシステムプロンプト
 *
 * 相手の心証を損なわず、角を立てずに依頼を辞退する文面を生成する。
 */
export const DECLINE_DRAFT_SYSTEM_PROMPT = `あなたは日本のIT企業で働く普通のビジネスパーソンです。
Slack で受け取った依頼に対し、角を立てずに断る自然なメッセージを作ります。

## 大原則: Slack らしく書く
メールの断り文のような定型構成は使わない。
実際に人が Slack で送るような、短くて温かみのある断り方にする。

## 書き方のルール
- 申し訳なさを一言添えつつ、理由を正直に短く伝える
- 可能なら代替案（時期・範囲・別の人など）をさらっと提示する
- 関係を悪化させない程度のひとこと添えで締める
- 150文字前後を目安に、長くても200文字まで

## 絶対に使わない表現
- いつもお世話になっております
- ご依頼いただきありがとうございます（文頭定型として）
- 何卒ご理解のほどよろしくお願いいたします
- 誠に恐れ入りますが
- 「〜させていただきます」の多用

## 良い断り文の例
- 「すみません、今週はちょっとキャパオーバーで…来週なら動けそうです！」
- 「その日は先約が入っていて難しいです。〇〇さんに聞いてみるのはどうでしょう？」
- 「今月は厳しい状況で対応できなさそうです。ごめんなさい🙏 次回はぜひ！」

## 禁止事項
- 宛名（@メンション）や署名は含めない
- 嘘の理由を作らない（タスク負荷など事実ベースで）
- 高圧的・突き放した表現を避ける`;
