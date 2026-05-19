/**
 * タスクルートのテスト
 *
 * DynamoDB 依存を顧めるためモックリポジトリを使用する。
 * テスト範囲: 一覧・作成・取得・更新・削除・候補承認/却下。
 */

import type { Task, TaskCandidate } from "@saboru/shared";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import type { DynamoTaskCandidateRepository } from "../../repositories/DynamoTaskCandidateRepository.js";
import type { DynamoTaskRepository } from "../../repositories/DynamoTaskRepository.js";
import { createTasksRoute } from "../../routes/tasks.js";
import type { AppEnv } from "../../types.js";

const MOCK_USER_ID = "user-test-123";

// Build a test app that injects userId as a Hono variable
function buildTestApp(
  taskRepo: Partial<DynamoTaskRepository>,
  candidateRepo: Partial<DynamoTaskCandidateRepository>,
) {
  const app = new Hono<AppEnv>();

  // 実際の JWT なしで userId を注入
  app.use("*", async (c, next) => {
    (c as unknown as { env: unknown }).env = {
      requestContext: {
        authorizer: { jwt: { claims: { sub: MOCK_USER_ID } } },
      },
    };
    await next();
  });

  app.route(
    "/tasks",
    createTasksRoute(
      taskRepo as DynamoTaskRepository,
      candidateRepo as DynamoTaskCandidateRepository,
    ),
  );
  app.onError(errorHandler);
  return app;
}

const sampleTask: Task = {
  PK: "USER#user-test-123",
  SK: "TASK#01ABC",
  taskId: "01ABC",
  userId: MOCK_USER_ID,
  status: "approved",
  title: "テストタスク",
  deadline: null,
  requester: "",
  description: "テスト",
  sourceType: "manual",
  approvedAt: "2026-05-17T00:00:00Z",
  updatedAt: "2026-05-17T00:00:00Z",
};

const sampleCandidate: TaskCandidate = {
  PK: "USER#user-test-123",
  SK: "TASK_CAND#01CAND",
  candidateId: "01CAND",
  title: "候補タスク",
  deadline: null,
  requester: "abc",
  description: "Slack から",
  sourceType: "slack",
  sourceRef: "msg-ref-1",
  status: "pending",
  createdAt: "2026-05-17T00:00:00Z",
  ttl: 9999999999,
};

describe("GET /tasks", () => {
  it("returns task list", async () => {
    const taskRepo = {
      findApprovedByUserId: vi.fn().mockResolvedValue([sampleTask]),
    };
    const candidateRepo = { findAllByUserId: vi.fn().mockResolvedValue([]) };
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].taskId).toBe("01ABC");
  });

  it("returns empty array when no tasks", async () => {
    const taskRepo = { findApprovedByUserId: vi.fn().mockResolvedValue([]) };
    const candidateRepo = {};
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toHaveLength(0);
  });
});

describe("POST /tasks", () => {
  it("creates a task and returns 201", async () => {
    const taskRepo = { create: vi.fn().mockResolvedValue(sampleTask) };
    const candidateRepo = {};
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "テストタスク", description: "内容" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.taskId).toBe("01ABC");
  });

  it("returns 400 for invalid body (empty title)", async () => {
    const taskRepo = { create: vi.fn() };
    const candidateRepo = {};
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for missing title", async () => {
    const taskRepo = { create: vi.fn() };
    const candidateRepo = {};
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "タイトルなし" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /tasks/candidates", () => {
  it("returns candidate list", async () => {
    const taskRepo = {};
    const candidateRepo = {
      findAllByUserId: vi.fn().mockResolvedValue([sampleCandidate]),
    };
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/candidates");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].candidateId).toBe("01CAND");
  });
});

describe("POST /tasks/candidates/:id/approve", () => {
  it("approves candidate and returns 201", async () => {
    const taskRepo = {};
    const candidateRepo = {
      findById: vi.fn().mockResolvedValue(sampleCandidate),
      approve: vi.fn().mockResolvedValue(sampleTask),
    };
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/candidates/01CAND/approve", {
      method: "POST",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.taskId).toBe("01ABC");
  });

  it("returns 404 when candidate not found", async () => {
    const taskRepo = {};
    const candidateRepo = { findById: vi.fn().mockResolvedValue(null) };
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/candidates/NOTFOUND/approve", {
      method: "POST",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("DELETE /tasks/candidates/:id", () => {
  it("deletes candidate and returns 204", async () => {
    const taskRepo = {};
    const candidateRepo = {
      findById: vi.fn().mockResolvedValue(sampleCandidate),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/candidates/01CAND", {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
  });

  it("returns 404 when candidate not found", async () => {
    const taskRepo = {};
    const candidateRepo = { findById: vi.fn().mockResolvedValue(null) };
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/candidates/NOTFOUND", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /tasks/:id", () => {
  it("returns task", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const candidateRepo = {};
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/01ABC");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taskId).toBe("01ABC");
  });

  it("returns 404 when task not found", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(null) };
    const candidateRepo = {};
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/NOTFOUND");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /tasks/:id", () => {
  it("updates task and returns 200", async () => {
    const updatedTask = { ...sampleTask, title: "更新タスク" };
    const taskRepo = {
      findById: vi.fn().mockResolvedValue(sampleTask),
      update: vi.fn().mockResolvedValue(updatedTask),
    };
    const candidateRepo = {};
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/01ABC", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "更新タスク" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("更新タスク");
  });

  it("returns 404 when task not found", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(null) };
    const candidateRepo = {};
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/NOTFOUND", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "xxx" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid PATCH body (title is empty string)", async () => {
    const taskRepo = { findById: vi.fn() };
    const candidateRepo = {};
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/01ABC", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("DELETE /tasks/:id", () => {
  it("soft deletes task and returns 204", async () => {
    const taskRepo = {
      findById: vi.fn().mockResolvedValue(sampleTask),
      softDelete: vi.fn().mockResolvedValue(undefined),
    };
    const candidateRepo = {};
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/01ABC", { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("returns 404 when task not found", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(null) };
    const candidateRepo = {};
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/NOTFOUND", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
