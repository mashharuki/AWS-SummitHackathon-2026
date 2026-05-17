/**
 * Tests for DynamoProposalRepository
 */

import { describe, it, expect, vi } from "vitest";
import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoProposalRepository } from "../../repositories/DynamoProposalRepository.js";

const TABLE = "proposals-test";

function mockClient(sendImpl: (command: unknown) => unknown) {
  return {
    send: vi.fn().mockImplementation(sendImpl),
  } as unknown as DynamoDBClient;
}

const sampleProposalItem = {
  PK: { S: "TASK#T01" },
  SK: { S: "PROPOSAL#2026-05-17T00:00:00Z" },
  taskId: { S: "T01" },
  userId: { S: "user1" },
  verdict: { S: "can_saboru" },
  summaryText: { S: "サボれる" },
  reasoning: { L: [{ S: "理由1" }] },
  chatMessage: { S: "今日はゆっくりしよ" },
  personaId: { S: "saboru_ottori" },
  evaluatedAt: { S: "2026-05-17T00:00:00Z" },
  nextCheckAt: { S: "2026-05-18T00:00:00Z" },
  tokenCount: { N: "100" },
};

describe("DynamoProposalRepository.findLatestByTaskId", () => {
  it("returns latest proposal when found", async () => {
    const client = mockClient(() => ({ Items: [sampleProposalItem] }));
    const repo = new DynamoProposalRepository(client, TABLE);

    const proposal = await repo.findLatestByTaskId("T01");
    expect(proposal).not.toBeNull();
    expect(proposal!.taskId).toBe("T01");
    expect(proposal!.verdict).toBe("can_saboru");
  });

  it("returns null when no proposals found", async () => {
    const client = mockClient(() => ({ Items: [] }));
    const repo = new DynamoProposalRepository(client, TABLE);

    const proposal = await repo.findLatestByTaskId("T01");
    expect(proposal).toBeNull();
  });

  it("returns null when Items is undefined", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoProposalRepository(client, TABLE);

    const proposal = await repo.findLatestByTaskId("T01");
    expect(proposal).toBeNull();
  });
});

describe("DynamoProposalRepository.save", () => {
  it("saves proposal and returns it", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoProposalRepository(client, TABLE);

    const saved = await repo.save({
      taskId: "T01",
      userId: "user1",
      verdict: "borderline",
      summaryText: "微妙",
      reasoning: ["理由"],
      chatMessage: "うーん",
      personaId: "saboru_ottori",
      evaluatedAt: "2026-05-17T00:00:00Z",
      nextCheckAt: "2026-05-18T00:00:00Z",
      tokenCount: 50,
    });

    expect(saved.PK).toBe("TASK#T01");
    expect(saved.SK).toBe("PROPOSAL#2026-05-17T00:00:00Z");
    expect(saved.verdict).toBe("borderline");
    expect(client.send).toHaveBeenCalledOnce();
  });

  it("saves proposal with cannot_saboru verdict", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoProposalRepository(client, TABLE);

    const saved = await repo.save({
      taskId: "T02",
      userId: "user2",
      verdict: "must_do",
      summaryText: "これは大事",
      reasoning: ["期限", "重要度"],
      chatMessage: "今日は頑張ろう",
      personaId: "saboru_ottori",
      evaluatedAt: "2026-05-17T12:00:00Z",
      nextCheckAt: "2026-05-18T12:00:00Z",
      tokenCount: 200,
    });

    expect(saved.verdict).toBe("must_do");
    expect(saved.PK).toBe("TASK#T02");
  });
});
