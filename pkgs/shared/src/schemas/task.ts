import { z } from "zod";

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

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
