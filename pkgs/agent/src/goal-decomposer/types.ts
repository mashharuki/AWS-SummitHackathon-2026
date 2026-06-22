import { z } from "zod";

/**
 * GoalDecomposer — WBS分解型定義
 *
 * SABOROUのPM機能: タスクのゴールをPMBOK 8th Edition WBS手法で
 * サブタスクに分解し、ガントチャートとサボり余白を計算する。
 */

export const SubTaskStatusSchema = z.enum([
  "pending",
  "approved",
  "executing",
  "done",
  "skipped",
]);
export type SubTaskStatus = z.infer<typeof SubTaskStatusSchema>;

export const SubTaskTypeSchema = z.enum(["work", "decision", "saboru"]);
export type SubTaskType = z.infer<typeof SubTaskTypeSchema>;

/**
 * SubTask — PM WBSで分解された1作業単位
 *
 * "saboru" は SABOROUが自動実行する作業 (AIエージェントに委譲可能)
 * "work"   は人間承認後にSABOROUが代行する通常作業
 * "decision" は人間の意思決定が必要な工程
 */
export const SubTaskSchema = z.object({
  id: z.string().min(1).max(60),
  taskId: z.string().min(1).max(128),
  title: z.string().min(1).max(120),
  description: z.string().max(600),
  estimatedMinutes: z.number().int().min(5).max(480),
  saborouType: SubTaskTypeSchema,
  status: SubTaskStatusSchema,
  order: z.number().int().min(0),
});
export type SubTask = z.infer<typeof SubTaskSchema>;

export const GoalAnalysisSchema = z.object({
  goalSummary: z.string().min(1).max(300),
  deliverable: z.string().min(1).max(300),
  subtasks: z.array(SubTaskSchema).min(1).max(12),
  totalEstimatedMinutes: z.number().int().min(0),
  freeTimeMinutes: z.number().int().min(0),
  freeTimeSuggestion: z.string().min(1).max(500),
  generatedAt: z.string().datetime(),
});
export type GoalAnalysis = z.infer<typeof GoalAnalysisSchema>;

/** Bedrockが返すWBS分解の生JSONスキーマ（上限はサニタイズ後に検証する） */
export const WbsDecomposeOutputSchema = z.object({
  goalSummary: z.string().min(1).max(300),
  deliverable: z.string().min(1).max(300),
  subtasks: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        title: z.string().min(1).max(120),
        description: z.string().max(600),
        estimatedMinutes: z.number().int().min(5).max(480),
        saborouType: SubTaskTypeSchema,
      }),
    )
    .min(1)
    .max(12),
  freeTimeSuggestion: z.string().min(1).max(500),
});
export type WbsDecomposeOutput = z.infer<typeof WbsDecomposeOutputSchema>;
