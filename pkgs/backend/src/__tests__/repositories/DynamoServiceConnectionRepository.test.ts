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

  it("returns empty when Items is undefined", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    const items = await repo.findAllByUserId("user1");
    expect(items).toEqual([]);
  });
});

describe("DynamoServiceConnectionRepository.findByUserAndService", () => {
  it("returns connection when found", async () => {
    const client = mockClient(() => ({ Item: sampleConnItem }));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    const conn = await repo.findByUserAndService("user1", "slack");
    expect(conn).not.toBeNull();
    expect(conn?.service).toBe("slack");
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

  it("fills connectedAt when omitted", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    const saved = await repo.saveForUser("user1", {
      service: "slack",
      status: "connected",
      secretArn: "arn:test:secret",
      expiresAt: null,
    });

    expect(saved.connectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("DynamoServiceConnectionRepository.saveForUser — slack identity", () => {
  it("derives slackLookupKey when both slackTeamId and slackUserId are present", async () => {
    let captured: { Item?: Record<string, unknown> } = {};
    const client = mockClient((command: unknown) => {
      captured = (command as { input: typeof captured }).input;
      return {};
    });
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    const saved = await repo.saveForUser("user1", {
      service: "slack",
      status: "connected",
      secretArn: "arn:test:secret",
      slackUserId: "U999",
      slackTeamId: "T999",
      expiresAt: null,
    });

    expect(saved.slackLookupKey).toBe("T999#U999");
    // marshall された Item にも slackLookupKey が含まれる
    expect(captured.Item?.slackLookupKey).toEqual({ S: "T999#U999" });
  });

  it("does not set slackLookupKey when slack identity is absent", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    const saved = await repo.saveForUser("user1", {
      service: "slack",
      status: "connected",
      secretArn: "arn:test:secret",
      expiresAt: null,
    });

    expect(saved.slackLookupKey).toBeUndefined();
  });
});

describe("DynamoServiceConnectionRepository.findCognitoSubBySlackIdentity", () => {
  it("returns cognitoSub from GSI lookup hit", async () => {
    const client = mockClient(() => ({
      Items: [{ PK: { S: "USER#cognito-abc" }, SK: { S: "CONN#slack" } }],
    }));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    const sub = await repo.findCognitoSubBySlackIdentity("T999", "U999");
    expect(sub).toBe("cognito-abc");
  });

  it("returns null when no item matches", async () => {
    const client = mockClient(() => ({ Items: [] }));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    const sub = await repo.findCognitoSubBySlackIdentity("T999", "U-unknown");
    expect(sub).toBeNull();
  });

  it("returns null when PK is not in USER# form", async () => {
    const client = mockClient(() => ({
      Items: [{ PK: { S: "WEIRD#x" }, SK: { S: "CONN#slack" } }],
    }));
    const repo = new DynamoServiceConnectionRepository(client, TABLE);

    const sub = await repo.findCognitoSubBySlackIdentity("T999", "U999");
    expect(sub).toBeNull();
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

// Note: save() was removed from IServiceConnectionRepository and DynamoServiceConnectionRepository.
// All callers should use saveForUser() directly (BE-C-3 fix).
