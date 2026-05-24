/**
 * DynamoGoogleCalendarCacheRepository のテスト
 *
 * テスト内容:
 * - findByUserId: キャッシュレコードが存在する場合・存在しない場合
 * - save: PK/SK 設定・upsert 動作・nextEventStartsInMinutes=null の marshall 処理
 */

import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { DynamoGoogleCalendarCacheRepository } from "../../repositories/DynamoGoogleCalendarCacheRepository.js";

const TABLE = "google-calendar-cache-test";

function mockClient(sendImpl: (command: unknown) => unknown) {
  return {
    send: vi.fn().mockImplementation(sendImpl),
  } as unknown as DynamoDBClient;
}

const sampleCacheItem = marshall({
  PK: "USER#user1",
  SK: "CACHE#calendar",
  userId: "user1",
  fetchedAt: "2026-05-24T10:00:00.000Z",
  upcomingEventCount: 3,
  nextEventStartsInMinutes: 15,
  freeSlotMinutesToday: 300,
  busyScore: 0.9,
  ttl: 1716624000,
});

describe("DynamoGoogleCalendarCacheRepository.findByUserId", () => {
  it("レコードが存在する場合は GoogleCalendarCacheRecord を返す", async () => {
    const client = mockClient(() => ({ Item: sampleCacheItem }));
    const repo = new DynamoGoogleCalendarCacheRepository(client, TABLE);

    const result = await repo.findByUserId("user1");
    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user1");
    expect(result?.upcomingEventCount).toBe(3);
    expect(result?.nextEventStartsInMinutes).toBe(15);
    expect(result?.freeSlotMinutesToday).toBe(300);
    expect(result?.busyScore).toBe(0.9);
    expect(result?.ttl).toBe(1716624000);
  });

  it("レコードが存在しない場合は null を返す", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoGoogleCalendarCacheRepository(client, TABLE);

    const result = await repo.findByUserId("user-no-cache");
    expect(result).toBeNull();
  });

  it("GetItemCommand に正しいキーを渡す", async () => {
    let capturedInput: unknown;
    const client = mockClient((cmd: unknown) => {
      capturedInput = (cmd as { input: unknown }).input;
      return {};
    });
    const repo = new DynamoGoogleCalendarCacheRepository(client, TABLE);

    await repo.findByUserId("user-abc");

    const input = capturedInput as {
      TableName: string;
      Key: Record<string, unknown>;
    };
    expect(input.TableName).toBe(TABLE);
    expect(input.Key).toEqual(
      marshall({ PK: "USER#user-abc", SK: "CACHE#calendar" }),
    );
  });
});

describe("DynamoGoogleCalendarCacheRepository.save", () => {
  it("PK / SK を自動付与して保存し、完全なレコードを返す", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoGoogleCalendarCacheRepository(client, TABLE);

    const result = await repo.save("user1", {
      userId: "user1",
      fetchedAt: "2026-05-24T10:00:00.000Z",
      upcomingEventCount: 2,
      nextEventStartsInMinutes: 20,
      freeSlotMinutesToday: 360,
      busyScore: 0.6,
      ttl: 1716624000,
    });

    expect(result.PK).toBe("USER#user1");
    expect(result.SK).toBe("CACHE#calendar");
    expect(result.upcomingEventCount).toBe(2);
    expect(result.busyScore).toBe(0.6);
    expect(client.send).toHaveBeenCalledOnce();
  });

  it("nextEventStartsInMinutes=null でも PutItem を正常に実行する (removeUndefinedValues)", async () => {
    const client = mockClient(() => ({}));
    const repo = new DynamoGoogleCalendarCacheRepository(client, TABLE);

    const result = await repo.save("user2", {
      userId: "user2",
      fetchedAt: "2026-05-24T10:00:00.000Z",
      upcomingEventCount: 0,
      nextEventStartsInMinutes: null,
      freeSlotMinutesToday: 480,
      busyScore: 0.0,
      ttl: 1716624000,
    });

    expect(result.nextEventStartsInMinutes).toBeNull();
    expect(client.send).toHaveBeenCalledOnce();
  });

  it("PutItemCommand に正しい TableName と Item を渡す", async () => {
    let capturedInput: unknown;
    const client = mockClient((cmd: unknown) => {
      capturedInput = (cmd as { input: unknown }).input;
      return {};
    });
    const repo = new DynamoGoogleCalendarCacheRepository(client, TABLE);

    await repo.save("user3", {
      userId: "user3",
      fetchedAt: "2026-05-24T10:00:00.000Z",
      upcomingEventCount: 5,
      nextEventStartsInMinutes: 5,
      freeSlotMinutesToday: 120,
      busyScore: 1.0,
      ttl: 1716624000,
    });

    const input = capturedInput as {
      TableName: string;
      Item: Record<string, unknown>;
    };
    expect(input.TableName).toBe(TABLE);
    // PK と SK が DynamoDB 形式でマーシャルされている
    expect(input.Item.PK).toEqual({ S: "USER#user3" });
    expect(input.Item.SK).toEqual({ S: "CACHE#calendar" });
  });
});
