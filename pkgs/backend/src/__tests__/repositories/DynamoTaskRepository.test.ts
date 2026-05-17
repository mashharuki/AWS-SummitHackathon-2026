/**
 * DynamoTaskRepository のテスト
 * 実際の AWS 呼び出しを顧みるためモック DynamoDB クライアントを使用する。
 */

import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { Task } from "@saboru/shared";
import { describe, expect, it, vi } from "vitest";
import { DynamoTaskRepository } from "../../repositories/DynamoTaskRepository.js";

const TABLE = "tasks-test";

function mockClient(sendImpl: (command: unknown) => unknown) {
  return {
    send: vi.fn().mockImplementation(sendImpl),
  } as unknown as DynamoDBClient;
}

const sampleTaskItem = {
  PK: { S: "USER#user1" },
  SK: { S: "TASK#01ABC" },
  taskId: { S: "01ABC" },
  userId: { S: "user1" },
  status: { S: "approved" },
  title: { S: "テストタスク" },
  deadline: { NULL: true },
  requester: { S: "" },
  description: { S: "" },
  sourceType: { S: "manual" },
  approvedAt: { S: "2026-05-17T00:00:00Z" },
  updatedAt: { S: "2026-05-17T00:00:00Z" },
};

describe("DynamoTaskRepository.findApprovedByUserId", () => {
  it("returns tasks from DynamoDB query", async () => {
    const client = mockClient(() => ({ Items: [sampleTaskItem] }));
    const repo = new DynamoTaskRepository(client, TABLE);

    const tasks = await repo.findApprovedByUserId("user1");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskId).toBe("01ABC");
    expect(client.send).toHaveBeenCalledOnce();
  });

  it("returns empty array when no items", async () => {
    const client = mockClient(() => ({ Items: [] }));
    const repo = new DynamoTaskRepository(client, TABLE);

    const tasks = await repo.findApprovedByUserId("user1");
    expect(tasks).toHaveLength(0);
  });

  it("returns empty array when Items is undefined", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoTaskRepository(client, TABLE);

    const tasks = await repo.findApprovedByUserId("user1");
    expect(tasks).toHaveLength(0);
  });
});

describe("DynamoTaskRepository.findById", () => {
  it("returns task when found", async () => {
    const client = mockClient(() => ({ Item: sampleTaskItem }));
    const repo = new DynamoTaskRepository(client, TABLE);

    const task = await repo.findById("user1", "01ABC");
    expect(task).not.toBeNull();
    expect(task!.taskId).toBe("01ABC");
  });

  it("returns null when not found", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoTaskRepository(client, TABLE);

    const task = await repo.findById("user1", "NOTFOUND");
    expect(task).toBeNull();
  });
});

describe("DynamoTaskRepository.create", () => {
  it("puts item and returns task with generated taskId", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoTaskRepository(client, TABLE);

    const task = await repo.create({
      userId: "user1",
      title: "新しいタスク",
      deadline: null,
      requester: "",
      description: "詳細",
      sourceType: "manual",
    });

    expect(task.taskId).toBeTruthy();
    expect(task.title).toBe("新しいタスク");
    expect(task.status).toBe("approved");
    expect(task.PK).toBe("USER#user1");
    expect(client.send).toHaveBeenCalledOnce();
  });
});

describe("DynamoTaskRepository.softDelete", () => {
  it("calls UpdateItem", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoTaskRepository(client, TABLE);

    await repo.softDelete("user1", "01ABC");
    expect(client.send).toHaveBeenCalledOnce();
  });
});

describe("DynamoTaskRepository.putFromTransaction", () => {
  it("calls PutItem with task data", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoTaskRepository(client, TABLE);

    const task: Task = {
      PK: "USER#user1",
      SK: "TASK#01ABC",
      taskId: "01ABC",
      userId: "user1",
      status: "approved",
      title: "タスク",
      deadline: null,
      requester: "",
      description: "",
      sourceType: "manual",
      approvedAt: "2026-05-17T00:00:00Z",
      updatedAt: "2026-05-17T00:00:00Z",
    };

    await repo.putFromTransaction(task);
    expect(client.send).toHaveBeenCalledOnce();
  });
});

describe("DynamoTaskRepository.update", () => {
  it("updates task and returns updated version (uses ReturnValues ALL_NEW)", async () => {
    // W-5 fix: update() now uses ReturnValues: "ALL_NEW" and reads from result.Attributes
    const client = mockClient(() => ({
      Attributes: { ...sampleTaskItem, title: { S: "更新済み" } },
    }));
    const repo = new DynamoTaskRepository(client, TABLE);

    const updated = await repo.update("user1", "01ABC", { title: "更新済み" });
    expect(updated.taskId).toBe("01ABC");
    expect(updated.title).toBe("更新済み");
  });

  it("updates task with deadline and description fields", async () => {
    const client = mockClient(() => ({
      Attributes: {
        ...sampleTaskItem,
        deadline: { S: "2026-12-31" },
        description: { S: "詳細説明" },
      },
    }));
    const repo = new DynamoTaskRepository(client, TABLE);

    const updated = await repo.update("user1", "01ABC", {
      deadline: "2026-12-31",
      description: "詳細説明",
    });
    expect(updated.deadline).toBe("2026-12-31");
  });

  it("throws when UpdateItem returns no Attributes", async () => {
    // ReturnValues: ALL_NEW should always return Attributes on success;
    // empty result means the item did not exist (ConditionExpression failed).
    const client = mockClient(() => ({})); // no Attributes
    const repo = new DynamoTaskRepository(client, TABLE);

    await expect(repo.update("user1", "01ABC", { title: "x" })).rejects.toThrow(
      "not found after update",
    );
  });
});

describe("DynamoTaskRepository.create — with deadline", () => {
  it("creates task with a deadline value", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoTaskRepository(client, TABLE);

    const task = await repo.create({
      userId: "user1",
      title: "期限ありタスク",
      deadline: "2026-12-31",
      requester: "",
      description: "",
      sourceType: "manual",
    });

    expect(task.deadline).toBe("2026-12-31");
  });
});
