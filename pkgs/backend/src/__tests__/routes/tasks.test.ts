/**
 * タスクルートのテスト
 *
 * DynamoDB 依存を顧めるためモックリポジトリを使用する。
 * テスト範囲: 一覧・作成・取得・更新・削除・候補承認/却下。
 */

import type {
  SaboriProposerAgentV2,
  SchedulePlannerAgent,
} from "@saboru/agent";
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
  plannerAgent: Partial<SchedulePlannerAgent> = {},
  proposerV2?: Partial<SaboriProposerAgentV2>,
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
      plannerAgent as SchedulePlannerAgent,
      proposerV2 as SaboriProposerAgentV2 | undefined,
    ),
  );
  app.onError(errorHandler);
  return app;
}

const sampleSteps = [
  {
    stepId: "s1",
    stepLabel: "初稿を起こす",
    durationMinutes: 45,
    bandType: "work" as const,
  },
  {
    stepId: "s2",
    stepLabel: "上司へ確認依頼",
    durationMinutes: 10,
    bandType: "decision" as const,
    // 意思決定は時刻アンカー（decisionAt）を持つ
    decisionAt: "2026-05-24T07:00:00.000Z",
  },
];

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

  it("passes empty description when omitted", async () => {
    const create = vi.fn().mockResolvedValue(sampleTask);
    const taskRepo = { create };
    const candidateRepo = {};
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "説明省略タスク" }),
    });
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ description: "" }),
    );
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
  it("approves candidate and returns 201 (no body — 後方互換)", async () => {
    const approve = vi.fn().mockResolvedValue(sampleTask);
    const taskRepo = {};
    const candidateRepo = {
      findById: vi.fn().mockResolvedValue(sampleCandidate),
      approve,
    };
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/candidates/01CAND/approve", {
      method: "POST",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.taskId).toBe("01ABC");
    // overrides 未指定（undefined）で approve が呼ばれる
    expect(approve).toHaveBeenCalledWith(MOCK_USER_ID, "01CAND", undefined);
  });

  it("passes overrides through to approve()", async () => {
    const approve = vi.fn().mockResolvedValue(sampleTask);
    const taskRepo = {};
    const candidateRepo = {
      findById: vi.fn().mockResolvedValue(sampleCandidate),
      approve,
    };
    const app = buildTestApp(taskRepo, candidateRepo);

    const overrides = {
      title: "編集後タイトル",
      deadline: "2026-06-01T09:00:00Z",
      description: "編集後の内容",
      plannedSteps: sampleSteps,
    };
    const res = await app.request("/tasks/candidates/01CAND/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrides }),
    });
    expect(res.status).toBe(201);
    expect(approve).toHaveBeenCalledWith(MOCK_USER_ID, "01CAND", overrides);
  });

  it("returns 400 for invalid overrides (empty title)", async () => {
    const approve = vi.fn();
    const taskRepo = {};
    const candidateRepo = {
      findById: vi.fn().mockResolvedValue(sampleCandidate),
      approve,
    };
    const app = buildTestApp(taskRepo, candidateRepo);

    const res = await app.request("/tasks/candidates/01CAND/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrides: { title: "" } }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(approve).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid plannedSteps (saboru bandType)", async () => {
    const approve = vi.fn();
    const candidateRepo = {
      findById: vi.fn().mockResolvedValue(sampleCandidate),
      approve,
    };
    const app = buildTestApp({}, candidateRepo);

    const res = await app.request("/tasks/candidates/01CAND/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        overrides: {
          plannedSteps: [{ ...sampleSteps[0], bandType: "saboru" }],
        },
      }),
    });
    expect(res.status).toBe(400);
    expect(approve).not.toHaveBeenCalled();
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

describe("POST /tasks/candidates/:id/plan-steps", () => {
  it("returns Bedrock step draft", async () => {
    const generateStepDraft = vi.fn().mockResolvedValue(sampleSteps);
    const candidateRepo = {
      findById: vi.fn().mockResolvedValue(sampleCandidate),
    };
    const app = buildTestApp({}, candidateRepo, { generateStepDraft });

    const res = await app.request("/tasks/candidates/01CAND/plan-steps", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.steps).toHaveLength(2);
    expect(body.steps[0].stepId).toBe("s1");
    expect(generateStepDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: sampleCandidate.title,
        deadline: sampleCandidate.deadline,
        description: sampleCandidate.description,
        refId: "01CAND",
      }),
    );
  });

  it("returns 404 when candidate not found", async () => {
    const generateStepDraft = vi.fn();
    const candidateRepo = { findById: vi.fn().mockResolvedValue(null) };
    const app = buildTestApp({}, candidateRepo, { generateStepDraft });

    const res = await app.request("/tasks/candidates/NOPE/plan-steps", {
      method: "POST",
    });
    expect(res.status).toBe(404);
    expect(generateStepDraft).not.toHaveBeenCalled();
  });

  it("returns 503 when Bedrock generation fails", async () => {
    const generateStepDraft = vi
      .fn()
      .mockRejectedValue(new Error("bedrock down"));
    const candidateRepo = {
      findById: vi.fn().mockResolvedValue(sampleCandidate),
    };
    const app = buildTestApp({}, candidateRepo, { generateStepDraft });

    const res = await app.request("/tasks/candidates/01CAND/plan-steps", {
      method: "POST",
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("STEP_DRAFT_FAILED");
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

describe("PATCH /tasks/:taskId/planned-steps", () => {
  const validSteps = [
    {
      stepId: "s1",
      stepLabel: "初稿を起こす",
      durationMinutes: 45,
      bandType: "work" as const,
    },
    {
      stepId: "s2",
      stepLabel: "上司へ確認依頼",
      durationMinutes: 10,
      bandType: "decision" as const,
      decisionAt: "2026-05-24T07:00:00.000Z",
    },
  ];

  it("正常更新: updatePlannedSteps が正しい引数で呼ばれ 200 を返す", async () => {
    const updatedTask = { ...sampleTask, plannedSteps: validSteps };
    const updatePlannedSteps = vi.fn().mockResolvedValue(updatedTask);
    const taskRepo = {
      findById: vi.fn().mockResolvedValue(sampleTask),
      updatePlannedSteps,
    };
    const app = buildTestApp(taskRepo, {});

    const res = await app.request("/tasks/01ABC/planned-steps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedSteps: validSteps }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taskId).toBe("01ABC");
    // リポジトリが正しい引数で呼ばれることを確認
    expect(updatePlannedSteps).toHaveBeenCalledWith(
      MOCK_USER_ID,
      "01ABC",
      validSteps,
    );
  });

  it("所有者確認: タスクが存在しない場合は 404 を返す", async () => {
    const updatePlannedSteps = vi.fn();
    const taskRepo = {
      findById: vi.fn().mockResolvedValue(null),
      updatePlannedSteps,
    };
    const app = buildTestApp(taskRepo, {});

    const res = await app.request("/tasks/NOTFOUND/planned-steps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedSteps: validSteps }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    // 所有者確認で止まるためリポジトリ更新は呼ばれない
    expect(updatePlannedSteps).not.toHaveBeenCalled();
  });

  it("バリデーション: plannedSteps が空配列の場合は 400 を返す", async () => {
    const updatePlannedSteps = vi.fn();
    const taskRepo = {
      findById: vi.fn().mockResolvedValue(sampleTask),
      updatePlannedSteps,
    };
    const app = buildTestApp(taskRepo, {});

    const res = await app.request("/tasks/01ABC/planned-steps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedSteps: [] }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(updatePlannedSteps).not.toHaveBeenCalled();
  });

  it("バリデーション: 9件以上のステップは 400 を返す", async () => {
    const tooManySteps = Array.from({ length: 9 }, (_, i) => ({
      stepId: `s${i + 1}`,
      stepLabel: `ステップ${i + 1}`,
      durationMinutes: 10,
      bandType: "work" as const,
    }));
    const updatePlannedSteps = vi.fn();
    const taskRepo = {
      findById: vi.fn().mockResolvedValue(sampleTask),
      updatePlannedSteps,
    };
    const app = buildTestApp(taskRepo, {});

    const res = await app.request("/tasks/01ABC/planned-steps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedSteps: tooManySteps }),
    });

    expect(res.status).toBe(400);
    expect(updatePlannedSteps).not.toHaveBeenCalled();
  });

  it("バリデーション: decision ステップに decisionAt が欠けている場合は 400 を返す", async () => {
    const stepsWithoutDecisionAt = [
      {
        stepId: "s1",
        stepLabel: "初稿を起こす",
        durationMinutes: 45,
        bandType: "work" as const,
      },
      {
        stepId: "s2",
        stepLabel: "上司へ確認依頼",
        durationMinutes: 10,
        bandType: "decision" as const,
        // decisionAt なし
      },
    ];
    const updatePlannedSteps = vi.fn();
    const taskRepo = {
      findById: vi.fn().mockResolvedValue(sampleTask),
      updatePlannedSteps,
    };
    const app = buildTestApp(taskRepo, {});

    const res = await app.request("/tasks/01ABC/planned-steps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedSteps: stepsWithoutDecisionAt }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.stepIds).toContain("s2");
    expect(updatePlannedSteps).not.toHaveBeenCalled();
  });

  it("anchorAt 付き work ステップが正常に保存される（work 移動の永続化）", async () => {
    const stepsWithAnchorAt = [
      {
        stepId: "s1",
        stepLabel: "初稿を起こす",
        durationMinutes: 30,
        bandType: "work" as const,
        anchorAt: "2026-05-24T07:30:00.000Z", // ドラッグ移動で固定されたアンカー
      },
      {
        stepId: "s2",
        stepLabel: "上司へ確認依頼",
        durationMinutes: 10,
        bandType: "decision" as const,
        decisionAt: "2026-05-24T09:00:00.000Z",
      },
    ];
    const updatedTask = { ...sampleTask, plannedSteps: stepsWithAnchorAt };
    const updatePlannedSteps = vi.fn().mockResolvedValue(updatedTask);
    const taskRepo = {
      findById: vi.fn().mockResolvedValue(sampleTask),
      updatePlannedSteps,
    };
    const app = buildTestApp(taskRepo, {});

    const res = await app.request("/tasks/01ABC/planned-steps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedSteps: stepsWithAnchorAt }),
    });

    expect(res.status).toBe(200);
    // anchorAt 付きステップが updatePlannedSteps に正しく渡されること
    expect(updatePlannedSteps).toHaveBeenCalledWith(
      MOCK_USER_ID,
      "01ABC",
      stepsWithAnchorAt,
    );
  });

  it("anchorAt なし work ステップも正常に保存される（後方互換）", async () => {
    const stepsWithoutAnchorAt = [
      {
        stepId: "s1",
        stepLabel: "初稿を起こす",
        durationMinutes: 45,
        bandType: "work" as const,
        // anchorAt なし → 後ろ詰めで配置
      },
    ];
    const updatedTask = { ...sampleTask, plannedSteps: stepsWithoutAnchorAt };
    const updatePlannedSteps = vi.fn().mockResolvedValue(updatedTask);
    const taskRepo = {
      findById: vi.fn().mockResolvedValue(sampleTask),
      updatePlannedSteps,
    };
    const app = buildTestApp(taskRepo, {});

    const res = await app.request("/tasks/01ABC/planned-steps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedSteps: stepsWithoutAnchorAt }),
    });

    expect(res.status).toBe(200);
    expect(updatePlannedSteps).toHaveBeenCalledWith(
      MOCK_USER_ID,
      "01ABC",
      stepsWithoutAnchorAt,
    );
  });
});

describe("POST /tasks/:id/report (U-V2-07)", () => {
  it("generates a progress report text and returns it", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const draftReply = vi.fn().mockResolvedValue({
      replyText: "現在確認・調整中です。引き続き対応いたします。",
      tone: "polite",
      reasoning: ["締切が設定されているため進捗を共有"],
    });
    const app = buildTestApp(taskRepo, {}, {}, { draftReply });

    const res = await app.request("/tasks/01ABC/report", { method: "POST" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taskId).toBe("01ABC");
    expect(body.reportText).toContain("確認・調整中");
    expect(body.tone).toBe("polite");
    expect(draftReply).toHaveBeenCalledOnce();
    // taskStatus にタスク名が含まれる
    const arg = draftReply.mock.calls[0][0];
    expect(arg.taskStatus).toContain("テストタスク");
  });

  it("returns 404 when the task is not found / not owned", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(null) };
    const draftReply = vi.fn();
    const app = buildTestApp(taskRepo, {}, {}, { draftReply });

    const res = await app.request("/tasks/missing/report", { method: "POST" });

    expect(res.status).toBe(404);
    expect(draftReply).not.toHaveBeenCalled();
  });

  it("returns 503 when the V2 agent is not wired in", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    // proposerV2 を渡さない（v1 後方互換: /report は 503）
    const app = buildTestApp(taskRepo, {});

    const res = await app.request("/tasks/01ABC/report", { method: "POST" });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("REPORT_GENERATION_FAILED");
  });

  it("returns 503 when report generation fails (Bedrock error)", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const draftReply = vi.fn().mockRejectedValue(new Error("bedrock timeout"));
    const app = buildTestApp(taskRepo, {}, {}, { draftReply });

    const res = await app.request("/tasks/01ABC/report", { method: "POST" });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("REPORT_GENERATION_FAILED");
  });
});
