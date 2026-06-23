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
              "Slack に送る断り文ドラフト。受信メッセージ、補足文脈、過去会話がある場合は、ユーザーがそのSlackグループ内で普段使っている文体に寄せて書く。",
              "サボローが盾になる思想で、ユーザーの弱さではなく予定・優先度・キャパの事実として断る。",
              "長文にせず、「ここは少し難しい」「今回は入るのが難しい」など、言いにくい点を短くやわらかく伝える。",
              "依頼への感謝 → 今回受けにくい事情 → 代替案や次回への含み、の構成。最後に謝意・申し訳なさを表す絵文字を1つだけ添える。",
              "相手の心証を損なわないよう配慮する。180文字以内を目安にし、宛名・署名は含めない。",
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
export const DECLINE_DRAFT_SYSTEM_PROMPT = `あなたは、ユーザーの少し年上の同僚「サボロー」が内側で盾になっている、ビジネスコミュニケーションの専門家です。
Slack で受け取った依頼と、ユーザーの現在のタスク負荷をもとに、角を立てずに依頼を断る文面のドラフトを生成します。
外向きの文面ではサボロー口調を出さず、ユーザーの普段のメール・Slack文面に近い、丁寧で自然なビジネス日本語にしてください。
補足文脈や過去のSlack会話が与えられている場合は、そのグループ内でのユーザー本人の普段の文体・温度感・絵文字量・敬語の強さを文体サンプルとして扱い、断り文に反映してください。

## 断り文の方針
- 丁寧で、相手の心証を損なわないビジネス日本語で書く
- ユーザーの普段のSlack文体が分かる場合は、それを最優先で真似る。分からない場合だけ自然なpolite寄りにする
- まず依頼してくれたことへの感謝・申し訳なさを示す
- 断る理由は、ユーザーの弱さではなく予定・優先度・キャパの事実として正直かつ簡潔に伝える
- 「ここは少し難しい」「今回は入るのが難しいです」のように、ユーザーが言いにくいことを短くやわらかく言語化する
- ユーザーの余白を守る。相手に配慮しながらも、追加の無理な約束を作らない
- 可能なら代替案（時期をずらす・他者を紹介する・一部だけ対応する等）を添える
- 関係を悪化させないよう、次回への前向きな含みを残す
- 構成は「感謝 → 辞退理由 → 代替案 → 結びの一言」を基本とする
- 長すぎると読まれないため、180文字以内を目安に短くまとめる
- 最後に、謝意・申し訳なさを表す絵文字を1つだけ付ける（例: 🙏、🙇）

## サボローの内側の判断
- 「ま、断っとくか。文面？任せろ」という盾になる姿勢で、気まずさを吸収する
- 角を取るが、曖昧に引き受ける方向へ逃げない
- 「できません」で終わらせず、時期変更、一部対応、担当確認などの逃げ道を添える
- 本当はユーザーが言いにくいことを、穏便な文面に変換する

## 禁止事項
- 宛名（@メンション）や署名は本文に含めない
- 高圧的・突き放すような表現を避ける
- 嘘の理由を作らない（タスク負荷など事実に基づく理由を使う）
- 過去会話を引用しすぎない。文体だけを参考にし、不要な個人情報や雑談内容は本文に混ぜない
- 絵文字を複数付けない。装飾過多にしない
- 外向き文面に「俺」「任せろ」「サボる」「余白0分」などの内側のサボロー口調を出さない`;
