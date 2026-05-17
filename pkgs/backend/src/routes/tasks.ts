/**
 * タスクルート
 *
 * GET    /tasks                      — 承認済みタスク一覧 (US-07)
 * POST   /tasks                      — タスク手動作成 (US-08)
 * GET    /tasks/candidates            — 保留中の候補一覧 (US-07)
 * POST   /tasks/candidates/:id/approve — 候補を承認 (US-07)
 * DELETE /tasks/candidates/:id        — 候補を却下
 * GET    /tasks/:id                   — 単一タスク取得
 * PATCH  /tasks/:id                   — タスクインライン編集 (US-08)
 * DELETE /tasks/:id                   — タスク論理削除 (US-08)
 */

import { zValidator } from "@hono/zod-validator";
import {
  CreateTaskSchema,
  SOURCE_TYPE,
  UpdateTaskSchema,
} from "@saboru/shared";
import { Hono } from "hono";
import { NotFoundError } from "../errors.js";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoTaskCandidateRepository } from "../repositories/DynamoTaskCandidateRepository.js";
import type { DynamoTaskRepository } from "../repositories/DynamoTaskRepository.js";
import type { AppEnv } from "../types.js";

export function createTasksRoute(
  taskRepository: DynamoTaskRepository,
  candidateRepository: DynamoTaskCandidateRepository,
): Hono<AppEnv> {
  const tasks = new Hono<AppEnv>();

  // 全タスクルートに認証を適用
  tasks.use("*", authMiddleware);

  /** GET /tasks — 承認済みタスク一覧 */
  tasks.get("/", async (c) => {
    const userId = c.get("userId");
    const items = await taskRepository.findApprovedByUserId(userId);
    return c.json({ tasks: items });
  });

  /** POST /tasks — タスク手動作成 */
  tasks.post(
    "/",
    zValidator("json", CreateTaskSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request body",
              details: result.error.flatten(),
            },
          },
          400,
        );
      }
    }),
    async (c) => {
      const userId = c.get("userId");
      const body = c.req.valid("json");
      const task = await taskRepository.create({
        userId,
        title: body.title,
        deadline: body.deadline ?? null,
        description: body.description ?? "",
        requester: "",
        sourceType: SOURCE_TYPE.MANUAL,
      });
      return c.json(task, 201);
    },
  );

  /** GET /tasks/candidates — Pending candidate list */
  tasks.get("/candidates", async (c) => {
    const userId = c.get("userId");
    const items = await candidateRepository.findAllByUserId(userId);
    return c.json({ candidates: items });
  });

  /** POST /tasks/candidates/:id/approve — Approve candidate */
  tasks.post("/candidates/:id/approve", async (c) => {
    const userId = c.get("userId");
    const candidateId = c.req.param("id");

    const candidate = await candidateRepository.findById(userId, candidateId);
    if (!candidate) {
      throw new NotFoundError(`Task candidate ${candidateId} not found`);
    }

    const approvedTask = await candidateRepository.approve(userId, candidateId);
    return c.json(approvedTask, 201);
  });

  /** DELETE /tasks/candidates/:id — Reject candidate */
  tasks.delete("/candidates/:id", async (c) => {
    const userId = c.get("userId");
    const candidateId = c.req.param("id");

    const candidate = await candidateRepository.findById(userId, candidateId);
    if (!candidate) {
      throw new NotFoundError(`Task candidate ${candidateId} not found`);
    }

    await candidateRepository.delete(userId, candidateId);
    return c.body(null, 204);
  });

  /** GET /tasks/:id — Single task */
  tasks.get("/:id", async (c) => {
    const userId = c.get("userId");
    const taskId = c.req.param("id");
    const task = await taskRepository.findById(userId, taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);
    return c.json(task);
  });

  /** PATCH /tasks/:id — Inline edit */
  tasks.patch(
    "/:id",
    zValidator("json", UpdateTaskSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request body",
              details: result.error.flatten(),
            },
          },
          400,
        );
      }
    }),
    async (c) => {
      const userId = c.get("userId");
      const taskId = c.req.param("id");
      const body = c.req.valid("json");

      const existing = await taskRepository.findById(userId, taskId);
      if (!existing) throw new NotFoundError(`Task ${taskId} not found`);

      const updated = await taskRepository.update(userId, taskId, body);
      return c.json(updated);
    },
  );

  /** DELETE /tasks/:id — Soft delete */
  tasks.delete("/:id", async (c) => {
    const userId = c.get("userId");
    const taskId = c.req.param("id");

    const existing = await taskRepository.findById(userId, taskId);
    if (!existing) throw new NotFoundError(`Task ${taskId} not found`);

    await taskRepository.softDelete(userId, taskId);
    return c.body(null, 204);
  });

  return tasks;
}
