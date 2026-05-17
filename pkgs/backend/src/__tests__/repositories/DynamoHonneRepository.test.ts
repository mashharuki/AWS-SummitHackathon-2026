/**
 * Tests for DynamoHonneRepository
 */

import { describe, it, expect, vi } from "vitest";
import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoHonneRepository } from "../../repositories/DynamoHonneRepository.js";

const TABLE = "honne-test";

function mockClient(sendImpl: (command: unknown) => unknown) {
  return {
    send: vi.fn().mockImplementation(sendImpl),
  } as unknown as DynamoDBClient;
}

const sampleHonneItem = {
  PK: { S: "USER#user1" },
  SK: { S: "HONNE#2026-05-17T00:00:00Z" },
  userId: { S: "user1" },
  taskId: { S: "T01" },
  type: { S: "quick_reply" },
  content: { S: "truly_tired" },
  proposalVerdict: { S: "can_saboru" },
  createdAt: { S: "2026-05-17T00:00:00Z" },
};

describe("DynamoHonneRepository.save", () => {
  it("puts honne data and returns it", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoHonneRepository(client, TABLE);

    const saved = await repo.save({
      userId: "user1",
      taskId: "T01",
      type: "quick_reply",
      content: "truly_tired",
      proposalVerdict: "can_saboru",
      createdAt: "2026-05-17T00:00:00Z",
    });

    expect(saved.userId).toBe("user1");
    expect(saved.PK).toBe("USER#user1");
    expect(saved.SK).toContain("HONNE#");
    expect(client.send).toHaveBeenCalledOnce();
  });

  it("auto-generates createdAt if not provided", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoHonneRepository(client, TABLE);

    const saved = await repo.save({
      userId: "user1",
      taskId: "T01",
      type: "free_text",
      content: "テキスト",
      proposalVerdict: "borderline",
    } as Parameters<typeof repo.save>[0]);

    expect(saved.createdAt).toBeTruthy();
  });
});

describe("DynamoHonneRepository.findAllByUserId", () => {
  it("returns honne data list", async () => {
    const client = mockClient(() => ({ Items: [sampleHonneItem] }));
    const repo = new DynamoHonneRepository(client, TABLE);

    const items = await repo.findAllByUserId("user1");
    expect(items).toHaveLength(1);
    expect(items[0].userId).toBe("user1");
  });

  it("returns empty array when no items", async () => {
    const client = mockClient(() => ({ Items: [] }));
    const repo = new DynamoHonneRepository(client, TABLE);

    const items = await repo.findAllByUserId("user1");
    expect(items).toHaveLength(0);
  });

  it("returns empty array when Items is undefined", async () => {
    const client = mockClient(() => ({})); // no Items key
    const repo = new DynamoHonneRepository(client, TABLE);

    const items = await repo.findAllByUserId("user1");
    expect(items).toHaveLength(0);
  });
});
