/**
 * Tests for POST /tasks/:taskId/honne
 */

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createHonneRoute } from "../../routes/honne.js";
import type { DynamoTaskRepository } from "../../repositories/DynamoTaskRepository.js";
import type { DynamoHonneRepository } from "../../repositories/DynamoHonneRepository.js";
import type { DynamoProposalRepository } from "../../repositories/DynamoProposalRepository.js";
import type { Task, Proposal } from "@saboru/shared";
import type { AppEnv } from "../../types.js";
import { errorHandler } from "../../middleware/error-handler.js";

const MOCK_USER_ID = "user-honne-test";

function buildTestApp(
  taskRepo: Partial<DynamoTaskRepository>,
  honneRepo: Partial<DynamoHonneRepository>,
  proposalRepo: Partial<DynamoProposalRepository>,
) {
  const app = new Hono<AppEnv>();
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
    createHonneRoute(
      taskRepo as DynamoTaskRepository,
      honneRepo as DynamoHonneRepository,
      proposalRepo as DynamoProposalRepository,
    ),
  );
  app.onError(errorHandler);
  return app;
}

const sampleTask: Task = {
  PK: "USER#user-honne-test",
  SK: "TASK#T01",
  taskId: "T01",
  userId: MOCK_USER_ID,
  status: "approved",
  title: "テスト",
  deadline: null,
  requester: "",
  description: "",
  sourceType: "manual",
  approvedAt: "2026-05-17T00:00:00Z",
  updatedAt: "2026-05-17T00:00:00Z",
};

const sampleProposal: Proposal = {
  PK: "TASK#T01",
  SK: "PROPOSAL#2026-05-17T00:00:00Z",
  taskId: "T01",
  userId: MOCK_USER_ID,
  verdict: "can_saboru",
  summaryText: "サボれるよ",
  reasoning: [],
  chatMessage: "今日はゆっくりしよ",
  personaId: "saboru_ottori",
  evaluatedAt: "2026-05-17T00:00:00Z",
  nextCheckAt: "2099-01-01T00:00:00Z",
  tokenCount: 100,
};

describe("POST /tasks/:taskId/honne", () => {
  it("records quick_reply and returns 201 with reply message", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const honneRepo = { save: vi.fn().mockResolvedValue({}) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(sampleProposal),
    };
    const app = buildTestApp(taskRepo, honneRepo, proposalRepo);

    const res = await app.request("/tasks/T01/honne", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "quick_reply", content: "truly_tired" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.recorded).toBe(true);
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });

  it("records free_text and returns 201", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const honneRepo = { save: vi.fn().mockResolvedValue({}) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const app = buildTestApp(taskRepo, honneRepo, proposalRepo);

    const res = await app.request("/tasks/T01/honne", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "free_text", content: "なんか疲れた" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.recorded).toBe(true);
  });

  it("returns 400 for invalid type", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const honneRepo = {};
    const proposalRepo = {};
    const app = buildTestApp(taskRepo, honneRepo, proposalRepo);

    const res = await app.request("/tasks/T01/honne", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "unknown_type", content: "xxx" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid quick_reply content", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const honneRepo = {};
    const proposalRepo = {};
    const app = buildTestApp(taskRepo, honneRepo, proposalRepo);

    const res = await app.request("/tasks/T01/honne", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "quick_reply", content: "invalid_content" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when task not found", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(null) };
    const honneRepo = {};
    const proposalRepo = {};
    const app = buildTestApp(taskRepo, honneRepo, proposalRepo);

    const res = await app.request("/tasks/NOTFOUND/honne", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "quick_reply", content: "truly_tired" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for free_text exceeding 500 chars", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const honneRepo = {};
    const proposalRepo = {};
    const app = buildTestApp(taskRepo, honneRepo, proposalRepo);

    const res = await app.request("/tasks/T01/honne", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "free_text", content: "x".repeat(501) }),
    });
    expect(res.status).toBe(400);
  });

  it("works without a prior proposal (verdict defaults to borderline)", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const honneRepo = { save: vi.fn().mockResolvedValue({}) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const app = buildTestApp(taskRepo, honneRepo, proposalRepo);

    const res = await app.request("/tasks/T01/honne", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "quick_reply", content: "agree_with_ai" }),
    });
    expect(res.status).toBe(201);
    expect(vi.mocked(honneRepo.save).mock.calls[0][0].proposalVerdict).toBe(
      "borderline",
    );
  });
});
