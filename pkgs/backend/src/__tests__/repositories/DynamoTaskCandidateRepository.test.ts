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
    // biome-ignore lint/style/noNonNullAssertion: non-null asserted after not.toBeNull() check
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

describe("DynamoTaskCandidateRepository.create", () => {
  it("creates candidate with explicit _userId", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    const created = await repo.create({
      candidateId: "01CANDNEW",
      title: "新規候補",
      deadline: null,
      requester: "req-hash",
      description: "create test",
      sourceType: "slack",
      sourceRef: "src-ref",
      status: "pending",
      createdAt: "2026-05-17T00:00:00Z",
      ttl: 9999999999,
      _userId: "user1",
    } as Parameters<typeof repo.create>[0]);

    expect(created.PK).toBe("USER#user1");
    expect(created.SK).toBe("TASK_CAND#01CANDNEW");
    expect(client.send).toHaveBeenCalledOnce();
  });

  it("throws when _userId is missing", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    await expect(
      repo.create({
        candidateId: "01CANDNEW",
        title: "新規候補",
        deadline: null,
        requester: "req-hash",
        description: "create test",
        sourceType: "slack",
        sourceRef: "src-ref",
        status: "pending",
        createdAt: "2026-05-17T00:00:00Z",
        ttl: 9999999999,
      }),
    ).rejects.toThrow("create() requires _userId");
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

  it("applies overrides (title/deadline/description) when provided", async () => {
    let callCount = 0;
    let putItem: Record<string, unknown> | undefined;
    const client = mockClient((command) => {
      callCount++;
      if (callCount === 1) return { Item: sampleCandItem }; // findById
      // TransactWriteItems — capture the Put item (2nd transact item)
      const input = (command as { input: { TransactItems: unknown[] } }).input;
      putItem = (
        input.TransactItems[1] as { Put: { Item: Record<string, unknown> } }
      ).Put.Item;
      return {};
    });
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    const task = await repo.approve("user1", "01CAND", {
      title: "編集後タイトル",
      deadline: "2026-06-01T09:00:00Z",
      description: "編集後の内容",
    });

    expect(task.title).toBe("編集後タイトル");
    expect(task.deadline).toBe("2026-06-01T09:00:00Z");
    expect(task.description).toBe("編集後の内容");
    // 候補の requester は保持（PII ハッシュ）
    expect(task.requester).toBe("req-hash");
    // marshall された Put item にも反映されている
    expect(putItem?.title).toEqual({ S: "編集後タイトル" });
  });

  it("persists plannedSteps to the Task when provided", async () => {
    let callCount = 0;
    let putItem: Record<string, unknown> | undefined;
    const client = mockClient((command) => {
      callCount++;
      if (callCount === 1) return { Item: sampleCandItem };
      const input = (command as { input: { TransactItems: unknown[] } }).input;
      putItem = (
        input.TransactItems[1] as { Put: { Item: Record<string, unknown> } }
      ).Put.Item;
      return {};
    });
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    const plannedSteps = [
      {
        stepId: "s1",
        stepLabel: "初稿",
        durationMinutes: 45,
        bandType: "work" as const,
      },
      {
        stepId: "s2",
        stepLabel: "上司確認",
        durationMinutes: 10,
        bandType: "decision" as const,
        decisionAt: "2026-05-24T07:00:00.000Z",
      },
    ];
    const task = await repo.approve("user1", "01CAND", { plannedSteps });

    // decisionAt を含むステップがそのまま Task に保存される
    expect(task.plannedSteps).toEqual(plannedSteps);
    expect(task.plannedSteps?.[1]?.decisionAt).toBe("2026-05-24T07:00:00.000Z");
    // marshall された Put item に plannedSteps (List) が含まれる
    expect(putItem?.plannedSteps).toBeDefined();
  });

  it("does not set plannedSteps when overrides omit it (legacy/backward compat)", async () => {
    let callCount = 0;
    let putItem: Record<string, unknown> | undefined;
    const client = mockClient((command) => {
      callCount++;
      if (callCount === 1) return { Item: sampleCandItem };
      const input = (command as { input: { TransactItems: unknown[] } }).input;
      putItem = (
        input.TransactItems[1] as { Put: { Item: Record<string, unknown> } }
      ).Put.Item;
      return {};
    });
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    const task = await repo.approve("user1", "01CAND");
    expect(task.plannedSteps).toBeUndefined();
    expect(putItem?.plannedSteps).toBeUndefined();
    // 候補の元値が使われる
    expect(task.title).toBe("候補タスク");
  });

  it("treats empty plannedSteps array as no steps (Bedrock fallback)", async () => {
    let callCount = 0;
    const client = mockClient(() => {
      callCount++;
      if (callCount === 1) return { Item: sampleCandItem };
      return {};
    });
    const repo = new DynamoTaskCandidateRepository(
      client,
      CAND_TABLE,
      TASK_TABLE,
    );

    const task = await repo.approve("user1", "01CAND", { plannedSteps: [] });
    expect(task.plannedSteps).toBeUndefined();
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
