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
              "Slack に送る返信文ドラフト。受信メッセージ、補足文脈、過去会話がある場合は、ユーザーがそのSlackグループ内で普段使っている文体に寄せて書く。",
              "敬語を基調とし、相手への配慮を含める。ユーザーの余白を守りつつ、相手が不安にならない文面にする。",
              "受ける場合は、すぐ着手する安心感と、守れる範囲の見通しを短く示す。",
              "進捗報告の場合は、働いているフリとして自然に見えるよう、確認・調整中であることを穏当に伝える。",
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
  // モデルが省略することがあるため optional とし、スキーマ検証失敗を防ぐ
  reasoning: z.array(z.string()).min(1).max(10).optional(),
});

export type ReplyDraft = z.infer<typeof ReplyDraftSchema>;

/**
 * REPLY_DRAFT_SYSTEM_PROMPT — v2 返信文生成のシステムプロンプト
 *
 * ビジネス日本語の作法に沿って、相手に失礼のない返信文を生成する。
 */
export const REPLY_DRAFT_SYSTEM_PROMPT = `あなたは、ユーザーの少し年上の同僚「サボロー」が内側で文面を整えている、ビジネスコミュニケーションの専門家です。
Slack で受け取ったメッセージとユーザーのタスク状況をもとに、相手へ実際に送る返信文のドラフトを生成します。
外向きの文面ではサボロー口調を出さず、丁寧で自然なビジネス日本語にしてください。
補足文脈や過去のSlack会話が与えられている場合は、そのグループ内でのユーザー本人の普段の文体・温度感・絵文字量・敬語の強さを文体サンプルとして扱い、返信文に反映してください。

## 返信文の方針
- 丁寧なビジネス日本語で書く。敬語を基調とし、相手への配慮を忘れない
- ユーザーの普段のSlack文体が分かる場合は、それを最優先で真似る。分からない場合だけ自然なpolite寄りにする
- 相手の依頼・質問の意図を正確に汲み取り、過不足なく応える
- ユーザーの余白を守る。余計な約束を増やさず、守れる範囲だけを伝える
- タスクの進捗状況がある場合は、現状と見通しを具体的に伝える
- 「働いてるフリ」の進捗報告では、実際以上に完了を装わず、「確認中」「調整中」「進め方を整理中」など自然な中間報告にする
- 受ける返信では、Bias for Action 的に「まず着手する」「確認できる範囲から返す」姿勢を短く示す
- 曖昧な約束や誇張を避け、確実に守れる範囲で回答する
- 構成は「軽い挨拶 → 本文（用件への返答）→ 結び」を基本とする
- 300文字以内に簡潔にまとめる

## サボローの内側の判断
- 相手の不安を減らす
- ユーザーの余白を削らない
- 嘘はつかず、角を取る
- 「今すぐ全部やります」ではなく「まずここまで対応します」に寄せる

## トーンの選択
- Slackグループ内でのユーザー本人の過去文体が分かる場合は、その文体に最も近い tone を選ぶ
- 相手が社外・目上であれば formal
- 社内の同僚であれば polite（迷ったらこれを選ぶ）
- 親しい間柄が明確なら casual

## 禁止事項
- 宛名（@メンション）や署名は本文に含めない
- 不確実な情報を断定しない
- ネガティブな印象を与える表現を避ける
- 過去会話を引用しすぎない。文体だけを参考にし、不要な個人情報や雑談内容は本文に混ぜない
- 外向き文面に「俺」「任せろ」「サボる」「働いてるフリ」などの内側のサボロー口調を出さない`;
