/**
 * Task routes
 *
 * GET    /tasks                      — List approved tasks (US-07)
 * POST   /tasks                      — Manually create task (US-08)
 * GET    /tasks/candidates            — List pending candidates (US-07)
 * POST   /tasks/candidates/:id/approve — Approve candidate (US-07)
 * DELETE /tasks/candidates/:id        — Reject candidate
 * GET    /tasks/:id                   — Get single task
 * PATCH  /tasks/:id                   — Update task inline (US-08)
 * DELETE /tasks/:id                   — Soft delete task (US-08)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../types.js";
import { authMiddleware } from "../middleware/auth.js";
import { NotFoundError } from "../errors.js";
import type { DynamoTaskRepository } from "../repositories/DynamoTaskRepository.js";
import type { DynamoTaskCandidateRepository } from "../repositories/DynamoTaskCandidateRepository.js";
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  SOURCE_TYPE,
} from "@saboru/shared";

export function createTasksRoute(
  taskRepository: DynamoTaskRepository,
  candidateRepository: DynamoTaskCandidateRepository,
): Hono<AppEnv> {
  const tasks = new Hono<AppEnv>();

  // Apply auth to all task routes
  tasks.use("*", authMiddleware);

  /** GET /tasks — Approved task list */
  tasks.get("/", async (c) => {
    const userId = c.get("userId");
    const items = await taskRepository.findApprovedByUserId(userId);
    return c.json({ tasks: items });
  });

  /** POST /tasks — Manual task creation */
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
