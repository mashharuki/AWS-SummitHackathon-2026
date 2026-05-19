/**
 * DynamoTaskCandidateRepository のテスト
 */

import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { DynamoTaskCandidateRepository } from "../../repositories/DynamoTaskCandidateRepository.js";

const CAND_TABLE = "candidates-test";
const TASK_TABLE = "tasks-test";

function mockClient(sendImpl: (command: unknown) => unknown) {
  return {
    send: vi.fn().mockImplementation(sendImpl),
  } as unknown as DynamoDBClient;
}

const sampleCandItem = {
  PK: { S: "USER#user1" },
  SK: { S: "TASK_CAND#01CAND" },
  candidateId: { S: "01CAND" },
  title: { S: "候補タスク" },
  deadline: { NULL: true },
  requester: { S: "req-hash" },
  description: { S: "Slack から" },
  sourceType: { S: "slack" },
  sourceRef: { S: "msg-ref" },
  status: { S: "pending" },
  createdAt: { S: "2026-05-17T00:00:00Z" },
  ttl: { N: "9999999999" },
};

describe("DynamoTaskCandidateRepository.findAllByUserId", () => {
  it("returns candidates", async () => {
    const client = mockClient(() => ({ Items: [sampleCandItem] }));
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    const items = await repo.findAllByUserId("user1");
    expect(items).toHaveLength(1);
    expect(items[0].candidateId).toBe("01CAND");
  });

  it("returns empty when no items", async () => {
    const client = mockClient(() => ({ Items: [] }));
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    const items = await repo.findAllByUserId("user1");
    expect(items).toHaveLength(0);
  });
});

describe("DynamoTaskCandidateRepository.findById", () => {
  it("returns candidate when found", async () => {
    const client = mockClient(() => ({ Item: sampleCandItem }));
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    const cand = await repo.findById("user1", "01CAND");
    expect(cand).not.toBeNull();
    expect(cand!.candidateId).toBe("01CAND");
  });

  it("returns null when not found", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    const cand = await repo.findById("user1", "NOTFOUND");
    expect(cand).toBeNull();
  });
});

describe("DynamoTaskCandidateRepository.delete", () => {
  it("calls DeleteItem", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    await repo.delete("user1", "01CAND");
    expect(client.send).toHaveBeenCalledOnce();
  });
});

describe("DynamoTaskCandidateRepository.approve", () => {
  it("throws when candidate not found", async () => {
    const client = mockClient(() => ({})); // findById returns no Item
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    await expect(repo.approve("user1", "NOTFOUND")).rejects.toThrow(
      "not found",
    );
  });

  it("performs TransactWriteItems on successful approval", async () => {
    let callCount = 0;
    const client = mockClient(() => {
      callCount++;
      if (callCount === 1) return { Item: sampleCandItem }; // findById
      return {}; // TransactWriteItems
    });
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    const task = await repo.approve("user1", "01CAND");
    expect(task.title).toBe("候補タスク");
    expect(task.status).toBe("approved");
    expect(client.send).toHaveBeenCalledTimes(2);
  });

  it("throws DynamoWriteFailedError when TransactWriteItems fails", async () => {
    let callCount = 0;
    const client = mockClient(() => {
      callCount++;
      if (callCount === 1) return { Item: sampleCandItem }; // findById OK
      throw new Error("ConditionalCheckFailed"); // TransactWriteItems fails
    });
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    await expect(repo.approve("user1", "01CAND")).rejects.toThrow(
      "TransactWriteItems failed",
    );
  });
});

describe("DynamoTaskCandidateRepository.createForUser", () => {
  it("creates candidate with auto-generated candidateId and ttl", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    const cand = await repo.createForUser("user1", {
      title: "新候補",
      deadline: null,
      requester: "req-hash",
      description: "説明",
      sourceType: "slack",
      sourceRef: "msg-ref",
      status: "pending",
    });

    expect(cand.candidateId).toBeTruthy();
    expect(cand.PK).toBe("USER#user1");
    expect(cand.ttl).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(client.send).toHaveBeenCalledOnce();
  });
});

describe("DynamoTaskCandidateRepository.findAllByUserId — empty Items", () => {
  it("returns empty array when Items is undefined", async () => {
    const client = mockClient(() => ({})); // no Items key
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    const items = await repo.findAllByUserId("user1");
    expect(items).toHaveLength(0);
  });
});
