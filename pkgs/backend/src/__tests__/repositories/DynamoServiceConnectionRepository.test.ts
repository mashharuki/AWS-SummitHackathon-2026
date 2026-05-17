/**
 * DynamoServiceConnectionRepository のテスト
 */

import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { DynamoServiceConnectionRepository } from "../../repositories/DynamoServiceConnectionRepository.js";

const TABLE = "connections-test";

function mockClient(sendImpl: (command: unknown) => unknown) {
  return {
    send: vi.fn().mockImplementation(sendImpl),
  } as unknown as DynamoDBClient;
}

const sampleConnItem = {
  PK: { S: "USER#user1" },
  SK: { S: "CONN#slack" },
  service: { S: "slack" },
  status: { S: "connected" },
  secretArn: { S: "arn:test" },
  connectedAt: { S: "2026-05-17T00:00:00Z" },
  expiresAt: { NULL: true },
};

describe("DynamoServiceConnectionRepository.findAllByUserId", () => {
  it("returns connections", async () => {
    const client = mockClient(() => ({ Items: [sampleConnItem] }));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    const items = await repo.findAllByUserId("user1");
    expect(items).toHaveLength(1);
    expect(items[0].service).toBe("slack");
  });

  it("returns empty when no items", async () => {
    const client = mockClient(() => ({ Items: [] }));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    const items = await repo.findAllByUserId("user1");
    expect(items).toHaveLength(0);
  });
});

describe("DynamoServiceConnectionRepository.findByUserAndService", () => {
  it("returns connection when found", async () => {
    const client = mockClient(() => ({ Item: sampleConnItem }));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    const conn = await repo.findByUserAndService("user1", "slack");
    expect(conn).not.toBeNull();
    expect(conn!.service).toBe("slack");
  });

  it("returns null when not found", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    const conn = await repo.findByUserAndService("user1", "slack");
    expect(conn).toBeNull();
  });
});

describe("DynamoServiceConnectionRepository.saveForUser", () => {
  it("saves connection and returns it", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    const saved = await repo.saveForUser("user1", {
      service: "slack",
      status: "connected",
      secretArn: "arn:test:secret",
      connectedAt: "2026-05-17T00:00:00Z",
      expiresAt: null,
    });

    expect(saved.PK).toBe("USER#user1");
    expect(saved.SK).toBe("CONN#slack");
    expect(client.send).toHaveBeenCalledOnce();
  });
});

describe("DynamoServiceConnectionRepository.disconnect", () => {
  it("calls UpdateItem", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    await repo.disconnect("user1", "slack");
    expect(client.send).toHaveBeenCalledOnce();
  });
});

describe("DynamoServiceConnectionRepository.save (throws)", () => {
  it("throws error (use saveForUser instead)", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    await expect(
      repo.save({
        service: "slack",
        status: "connected",
        secretArn: "arn:test",
        connectedAt: "2026-05-17T00:00:00Z",
        expiresAt: null,
      }),
    ).rejects.toThrow("Use saveForUser");
  });
});
