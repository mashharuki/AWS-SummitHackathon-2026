import { z } from "zod";
import { ScheduleStepSchema } from "../types/schedule";

/**
 * タスク手動作成リクエストのバリデーション
 * POST /api/tasks のリクエストボディバリデーションに使用
 */
export const CreateTaskSchema = z.object({
  title: z
    .string()
    .min(1, "タスク名は必須です")
    .max(200, "タスク名は200文字以内です"),
  deadline: z
    .string()
    .datetime({ message: "締切は ISO 8601 形式で指定してください" })
    .nullable()
    .optional(),
  description: z.string().max(1000, "作業内容は1000文字以内です").optional(),
});

/**
 * タスク更新リクエストのバリデーション
 * PATCH /api/tasks/:id のリクエストボディバリデーションに使用
 */
export const UpdateTaskSchema = CreateTaskSchema.partial();

/**
 * 候補承認時に上書きする内容（承認確認モーダルで編集された値）のバリデーション
 * POST /api/tasks/candidates/:id/approve のリクエストボディ `overrides` に使用。
 *
 * すべて任意。省略されたフィールドは候補の元の値がそのまま使われる（後方互換）。
 * plannedSteps が指定されると、その確定済みステップが Task に保存され、
 * ガント生成時の Bedrock 再呼び出しが省略される。
 */
export const ApproveOverridesSchema = z.object({
  title: z
    .string()
    .min(1, "タスク名は必須です")
    .max(200, "タスク名は200文字以内です")
    .optional(),
  deadline: z
    .string()
    .datetime({ message: "締切は ISO 8601 形式で指定してください" })
    .nullable()
    .optional(),
  description: z.string().max(1000, "作業内容は1000文字以内です").optional(),
  plannedSteps: z
    .array(ScheduleStepSchema)
    .min(1, "ステップは1件以上指定してください")
    .max(8, "ステップは8件以内です")
    .optional(),
});

/**
 * ガントUI のドラッグ/リサイズ編集結果を永続化するリクエストのバリデーション
 * PATCH /api/tasks/:taskId/planned-steps のリクエストボディバリデーションに使用
 *
 * plannedSteps 全体を上書きする。1〜8件の制約は ApproveOverridesSchema と揃える。
 * decision ステップの decisionAt はサーバ側でも必須チェックを行う。
 */
export const UpdatePlannedStepsSchema = z.object({
  plannedSteps: z
    .array(ScheduleStepSchema)
    .min(1, "ステップは1件以上指定してください")
    .max(8, "ステップは8件以内です"),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type ApproveOverridesInput = z.infer<typeof ApproveOverridesSchema>;
export type UpdatePlannedStepsInput = z.infer<typeof UpdatePlannedStepsSchema>;
