import type { Tool } from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";

/**
 * plan_schedule Tool — 段取り逆算 Bedrock Tool Use スキーマ
 *
 * toolChoice.tool による強制呼び出しで、Claude Sonnet 4.6 から
 * 「作業ステップ分解 + 各ステップの所要時間・バンド種別」の構造化出力を保証する。
 *
 * 重要: このツールは「さぼろう」帯（saboru）を生成しない。
 * さぼろう帯は呼び出し元（SchedulePlannerAgent）がステップ間の空き時間から
 * 決定論的に算出する（saboruBlockCalc.ts）。
 *
 * 設計: DP-02（toolChoice.tool 強制）/ DP-03（Zod バリデーション）を踏襲。
 */

export const PLAN_SCHEDULE_TOOL_NAME = "plan_schedule";

/** LLM が返す 1 ステップのスキーマ */
export const ScheduleStepSchema = z.object({
  stepId: z.string().min(1).max(30),
  stepLabel: z.string().min(1).max(60),
  durationMinutes: z.number().int().min(5).max(480),
  bandType: z.enum(["work", "decision"]),
  rationale: z.string().max(200).optional(),
});
export type ScheduleStep = z.infer<typeof ScheduleStepSchema>;

/** plan_schedule ツール出力スキーマ（LLM が返す） */
export const PlanScheduleOutputSchema = z.object({
  steps: z.array(ScheduleStepSchema).min(2).max(8),
});
export type PlanScheduleOutput = z.infer<typeof PlanScheduleOutputSchema>;

/** Bedrock ConverseAPI に渡すツール定義 */
export const PLAN_SCHEDULE_TOOL: Tool = {
  toolSpec: {
    name: PLAN_SCHEDULE_TOOL_NAME,
    description: [
      "タスクを実行可能な作業ステップに分解し、各ステップの所要時間（分）と",
      "バンド種別（work=通常作業 / decision=意思決定が必要）を返す。",
      "さぼろう帯は生成しない（呼び出し元が空き時間から算出する）。",
      "ステップは時系列に並べ、合計が締切までに収まる現実的な見積りにすること。",
    ].join(""),
    inputSchema: {
      json: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            description: "作業ステップの配列（2〜8件、時系列順）",
            minItems: 2,
            maxItems: 8,
            items: {
              type: "object",
              properties: {
                stepId: {
                  type: "string",
                  description: "ステップID（s1, s2, ... の形式）",
                },
                stepLabel: {
                  type: "string",
                  description:
                    "ステップ表示名（最大60文字。例:「議事録を文字起こし」）",
                },
                durationMinutes: {
                  type: "integer",
                  description: "所要時間（分、5〜480）",
                },
                bandType: {
                  type: "string",
                  enum: ["work", "decision"],
                  description:
                    "work=手を動かす作業 / decision=判断・確認が必要な工程",
                },
                rationale: {
                  type: "string",
                  description: "このステップが必要な理由（任意、最大200文字）",
                },
              },
              required: ["stepId", "stepLabel", "durationMinutes", "bandType"],
            },
          },
        },
        required: ["steps"],
      },
    },
  },
};

/**
 * SCHEDULE_SYSTEM_PROMPT — 段取り逆算のシステムプロンプト
 *
 * 「やらなくていいことを見極める」SABOROU の思想に沿い、
 * 過剰なステップ分解を避け、本当に必要な最小限の工程に絞る。
 */
export const SCHEDULE_SYSTEM_PROMPT = `あなたはタスクの「段取り逆算」を行う専門家です。
与えられたタスクを、締切までに終わらせるための作業ステップに分解してください。

## 分解の思想
- やることを増やすのではなく、本当に必要な最小限の工程に絞る
- 各ステップは「手を動かす作業（work）」か「判断・確認（decision）」かを明確に分ける
- 所要時間は現実的に見積もる（短すぎず長すぎず）
- ステップは時系列順に並べる

## バンド種別の使い分け
- work: 資料作成・文章作成・コーディングなど、実際に手を動かす工程
- decision: 上司確認・関係者へのレビュー依頼・方針判断など、判断が絡む工程

## 注意
- ステップ間の「空き時間」は呼び出し側が自動で「さぼろう」帯にするため、あなたは空き時間を作らなくてよい
- 2〜8ステップの範囲で、過剰に細かくしない`;
