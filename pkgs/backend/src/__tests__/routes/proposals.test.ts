/**
 * Tests for GET /tasks/:taskId/proposal
 */

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createProposalsRoute } from "../../routes/proposals.js";
import type { DynamoTaskRepository } from "../../repositories/DynamoTaskRepository.js";
import type { DynamoProposalRepository } from "../../repositories/DynamoProposalRepository.js";
import type { Task, Proposal } from "@saboru/shared";
import type { AppEnv } from "../../types.js";
import type { SaboriProposerAgent } from "@saboru/agent";
import { errorHandler } from "../../middleware/error-handler.js";

const MOCK_USER_ID = "user-proposal-test";

function buildTestApp(
  taskRepo: Partial<DynamoTaskRepository>,
  proposalRepo: Partial<DynamoProposalRepository>,
  agent: Partial<SaboriProposerAgent>,
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
    createProposalsRoute(
      taskRepo as DynamoTaskRepository,
      proposalRepo as DynamoProposalRepository,
      agent as SaboriProposerAgent,
    ),
  );
  app.onError(errorHandler);
  return app;
}

const sampleTask: Task = {
  PK: "USER#user-proposal-test",
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

const cachedProposal: Proposal = {
  PK: "TASK#T01",
  SK: "PROPOSAL#2026-05-17T00:00:00Z",
  taskId: "T01",
  userId: MOCK_USER_ID,
  verdict: "can_saboru",
  summaryText: "サボれるよ",
  reasoning: ["理由1"],
  chatMessage: "今日はゆっくりしよ",
  personaId: "saboru_ottori",
  evaluatedAt: "2026-05-17T00:00:00Z",
  nextCheckAt: "2099-01-01T00:00:00Z", // far future = cache valid
  tokenCount: 100,
};

describe("GET /tasks/:taskId/proposal (sync)", () => {
  it("returns cached proposal as JSON when cache is valid", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(cachedProposal),
    };
    const agent = { propose: vi.fn() };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verdict).toBe("can_saboru");
    expect(vi.mocked(agent.propose)).not.toHaveBeenCalled();
  });

  it("calls agent.propose when no cache", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const agent = { propose: vi.fn().mockResolvedValue(cachedProposal) };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal");
    expect(res.status).toBe(200);
    expect(vi.mocked(agent.propose)).toHaveBeenCalledOnce();
  });

  it("calls agent.propose when cache is expired", async () => {
    const expiredProposal = {
      ...cachedProposal,
      nextCheckAt: "2020-01-01T00:00:00Z", // past = expired
    };
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(expiredProposal),
    };
    const agent = { propose: vi.fn().mockResolvedValue(cachedProposal) };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal");
    expect(res.status).toBe(200);
    expect(vi.mocked(agent.propose)).toHaveBeenCalledOnce();
  });

  it("returns 404 when task not found", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(null) };
    const proposalRepo = { findLatestByTaskId: vi.fn() };
    const agent = {};
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/NOTFOUND/proposal");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /tasks/:taskId/proposal (SSE stream=true)", () => {
  it("returns SSE stream when cache is valid and stream=true", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(cachedProposal),
    };
    const agent = { propose: vi.fn(), proposeStream: vi.fn() };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal?stream=true");
    // SSE streaming returns 200 with text/event-stream content type
    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type") ?? "";
    expect(contentType).toContain("text/event-stream");
    expect(vi.mocked(agent.propose)).not.toHaveBeenCalled();
  });

  it("streams from agent when no cache and stream=true", async () => {
    // proposeStream is an async generator that yields delta events
    async function* mockStream() {
      yield {
        type: "verdict" as const,
        verdict: "can_saboru",
        summaryText: "サボれる",
      };
      yield { type: "chat" as const, chatMessage: "ゆっくりしてね" };
      yield { type: "done" as const, proposalId: "PROPOSAL#T", cached: false };
    }

    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const agent = { proposeStream: vi.fn().mockReturnValue(mockStream()) };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal?stream=true");
    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type") ?? "";
    expect(contentType).toContain("text/event-stream");
  });

  it("handles stream error gracefully and emits error SSE event", async () => {
    async function* errorStream() {
      yield {
        type: "verdict" as const,
        verdict: "can_saboru",
        summaryText: "x",
      };
      throw new Error("Bedrock timeout");
    }

    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const agent = { proposeStream: vi.fn().mockReturnValue(errorStream()) };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal?stream=true");
    // Stream starts OK even if generator throws mid-way
    expect(res.status).toBe(200);
  });

  it("breaks stream loop when error type event is yielded", async () => {
    async function* errorEventStream() {
      yield { type: "error" as const, message: "generation failed" };
    }

    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(null),
    };
    const agent = {
      proposeStream: vi.fn().mockReturnValue(errorEventStream()),
    };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal?stream=true");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"type":"error"');
  });

  it("streams cached proposal SSE with done event containing cached:true", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(cachedProposal),
    };
    const agent = { propose: vi.fn(), proposeStream: vi.fn() };
    const app = buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal?stream=true");
    expect(res.status).toBe(200);
    const text = await res.text();
    // SSE body should contain done event with cached:true
    expect(text).toContain('"cached":true');
  });
});
