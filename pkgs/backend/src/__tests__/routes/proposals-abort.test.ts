import type { SaboriProposerAgent } from "@saboru/agent";
import type { Proposal, Task } from "@saboru/shared";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import type { DynamoProposalRepository } from "../../repositories/DynamoProposalRepository.js";
import type { DynamoTaskRepository } from "../../repositories/DynamoTaskRepository.js";
import type { AppEnv } from "../../types.js";

vi.mock("hono/streaming", () => ({
  streamSSE: vi.fn(async (c: { header: (name: string, value: string) => void }, fn) => {
    c.header("content-type", "text/event-stream");
    const stream = {
      onAbort: (cb: () => void) => cb(),
      writeSSE: vi.fn(async () => undefined),
    };
    await fn(stream);
    return new Response("", {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }),
}));

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
  return import("../../routes/proposals.js").then(({ createProposalsRoute }) => {
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
  });
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

const expiredProposal: Proposal = {
  PK: "TASK#T01",
  SK: "PROPOSAL#2026-05-17T00:00:00Z",
  taskId: "T01",
  userId: MOCK_USER_ID,
  verdict: "can_saboru",
  summaryText: "expired cache",
  reasoning: ["r1"],
  chatMessage: "msg",
  personaId: "p1",
  evaluatedAt: "2026-05-17T00:00:00Z",
  nextCheckAt: "2020-01-01T00:00:00Z",
  tokenCount: 100,
};

describe("GET /tasks/:taskId/proposal stream abort hook", () => {
  it("registers and executes onAbort callback path", async () => {
    async function* mockStream() {
      yield { type: "complete" as const, payload: { ok: true } };
    }

    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const proposalRepo = {
      findLatestByTaskId: vi.fn().mockResolvedValue(expiredProposal),
    };
    const agent = { proposeStream: vi.fn().mockReturnValue(mockStream()) };
    const app = await buildTestApp(taskRepo, proposalRepo, agent);

    const res = await app.request("/tasks/T01/proposal?stream=true");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });
});
