/**
 * Tests for DynamoUserRepository
 */

import { describe, it, expect, vi } from "vitest";
import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoUserRepository } from "../../repositories/DynamoUserRepository.js";

const TABLE = "users-test";

function mockClient(sendImpl: (command: unknown) => unknown) {
  return {
    send: vi.fn().mockImplementation(sendImpl),
  } as unknown as DynamoDBClient;
}

const sampleUserItem = {
  PK: { S: "USER#sub-123" },
  SK: { S: "PROFILE" },
  cognitoSub: { S: "sub-123" },
  email: { S: "test@example.com" },
  name: { S: "テストユーザー" },
  createdAt: { S: "2026-05-17T00:00:00Z" },
  updatedAt: { S: "2026-05-17T00:00:00Z" },
};

describe("DynamoUserRepository.findById", () => {
  it("returns user when found", async () => {
    const client = mockClient(() => ({ Item: sampleUserItem }));
    const repo = new DynamoUserRepository(client, TABLE);

    const user = await repo.findById("sub-123");
    expect(user).not.toBeNull();
    expect(user!.cognitoSub).toBe("sub-123");
  });

  it("returns null when not found", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoUserRepository(client, TABLE);

    const user = await repo.findById("nonexistent");
    expect(user).toBeNull();
  });
});

describe("DynamoUserRepository.upsert", () => {
  it("puts user and returns it", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoUserRepository(client, TABLE);

    const user = await repo.upsert({
      cognitoSub: "sub-123",
      email: "test@example.com",
      name: "テストユーザー",
      createdAt: "2026-05-17T00:00:00Z",
      updatedAt: "2026-05-17T00:00:00Z",
    });

    expect(user.PK).toBe("USER#sub-123");
    expect(user.SK).toBe("PROFILE");
    expect(user.cognitoSub).toBe("sub-123");
    expect(client.send).toHaveBeenCalledOnce();
  });

  it("auto-generates timestamps if not provided", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoUserRepository(client, TABLE);

    const user = await repo.upsert({
      cognitoSub: "sub-456",
      email: "new@example.com",
      name: "新しいユーザー",
    } as Parameters<typeof repo.upsert>[0]);

    expect(user.updatedAt).toBeTruthy();
  });
});
