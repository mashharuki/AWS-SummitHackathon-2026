import type { Tool } from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";

/**
 * sabori_judgment Tool — フェーズ 2 Bedrock Tool Use スキーマ
 *
 * toolChoice.tool による強制ツール呼び出しで、Claude Sonnet 3.5 からの
 * サボり判定の構造化出力を保証する。
 *
 * 設計: DP-02 (toolChoice.tool 強制), DP-03 (Zod バリデーション)
 */

export const SABORI_JUDGMENT_TOOL_NAME = "sabori_judgment";

export const SABORI_JUDGMENT_TOOL: Tool = {
  toolSpec: {
    name: SABORI_JUDGMENT_TOOL_NAME,
    description: "タスクの文脈を分析し、サボり可否を判定して構造化データを返す",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          verdict: {
            type: "string",
            enum: ["can_saboru", "borderline", "must_do"],
            description: [
              "can_saboru: 今すぐサボれる。締切まで余裕があり、依頼者からのプレッシャーも低い",
              "borderline: グレーゾーン。近日中に状況確認が必要",
              "must_do: 危険。今すぐ動かないとまずい状況",
            ].join("\n"),
          },
          summaryText: {
            type: "string",
            description:
              "60文字以内の1行判断文。例: 「まだ寝かせてOK。明日14時までに確認だけすれば逃げ切れる。」",
            maxLength: 60,
          },
          reasoning: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 5,
            description:
              "判断の根拠。各項目は「〜だから」「〜のため」で終わる具体的な事実ベースの文章",
          },
          rawChatMessage: {
            type: "string",
            description:
              "100〜150文字の解説文。後でサボロー口調に変換するため中立的な口調で書く",
          },
          nextCheckOffsetMinutes: {
            type: "number",
            description: [
              "次回再評価までの分数。判定に応じた目安:",
              "  can_saboru: 120〜360分（2〜6時間後）",
              "  borderline: 30〜60分（状況変化を監視）",
              "  must_do: 10〜20分（緊急監視）",
              "締切までの残り時間も考慮して決定すること",
            ].join("\n"),
          },
          appliedFramework: {
            type: "array",
            items: { type: "string" },
            description:
              '判定に影響した心理学フレームワーク名を列挙。例: ["CEM (Karau & Williams 1993)", "Sucker Effect (Kerr 1983)"]',
          },
        },
        required: [
          "verdict",
          "summaryText",
          "reasoning",
          "rawChatMessage",
          "nextCheckOffsetMinutes",
        ],
      },
    },
  },
};

/**
 * Zod schema for validating sabori_judgment tool output (DP-03)
 */
export const LLMJudgmentSchema = z.object({
  verdict: z.enum(["can_saboru", "borderline", "must_do"]),
  summaryText: z.string().min(1).max(120),
  reasoning: z.array(z.string()).min(1).max(10),
  rawChatMessage: z.string().min(1),
  nextCheckOffsetMinutes: z.number().int().positive(),
  appliedFramework: z.array(z.string()).optional(),
});

/**
 * SABORI_SYSTEM_PROMPT — Phase 2 system prompt for sabori judgment
 *
 * Based on 5 psychological frameworks:
 * - CEM (Karau & Williams, 1993): Social loafing / context coverage
 * - Identifiability (Williams et al., 1981): requester online = high identifiability
 * - Sucker Effect (Kerr, 1983): don't want to work if others aren't
 * - SDT (Ryan & Deci, 2000): external pressure from reminders
 * - Expectancy Theory (Vroom, 1964): effort-outcome expectancy by deadline
 */
export const SABORI_SYSTEM_PROMPT = `あなたは「サボリスト」です。与えられたタスクの文脈情報を読んで、
ユーザーが「今サボれるかどうか」を判定する専門家です。

## 判定の思想
- サボることは怠惰ではなく、有限なエネルギーの最適配分である
- 「リマインドが来ていない = 依頼者はまだ焦っていない」という現実を直視する
- 締切・会議・依頼者の行動パターンから「本当の危険ライン」を見極める
- ユーザーが安心してサボれる「根拠」を具体的に提示することが最重要

## 判定基準（ガイドライン）
【can_saboru の典型シグナル】
- 締切まで24時間以上ある
- 依頼者からのリマインドが0回
- 依頼者のステータスが away/offline

【borderline の典型シグナル】
- 締切まで12〜24時間
- リマインドが1回来ている
- 関連会議まで3〜12時間

【must_do の典型シグナル】
- 締切まで12時間未満
- リマインドが2回以上
- 依頼者のステータスが online で最近アクティブ

## 心理学的フレームワーク（判定に反映すること）
- Identifiability 低 → can_saboru 方向
- Sucker Effect 発動 → can_saboru 方向
- Expectancy 高 → can_saboru 方向
- SDT 外発的プレッシャー低 → can_saboru 方向`;
