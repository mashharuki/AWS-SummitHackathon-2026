/**
 * DynamoGoogleCalendarCacheRepository
 *
 * GoogleCalendarCache テーブルの DynamoDB 実装。
 *
 * アクセスパターン:
 * - GetItem PK=USER#<userId> SK=CACHE#calendar — findByUserId
 * - PutItem（upsert）— save
 *
 * キー設計:
 * - PK: USER#<cognitoSub>
 * - SK: CACHE#calendar（ユーザーあたり1レコード・都度上書き）
 *
 * TTL: 24h（fetchedAt + 86400秒）
 */

import {
  type DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export interface GoogleCalendarCacheRecord {
  PK: string;
  SK: string;
  userId: string;
  fetchedAt: string;
  upcomingEventCount: number;
  nextEventStartsInMinutes: number | null;
  freeSlotMinutesToday: number;
  busyScore: number;
  ttl: number;
}

export class DynamoGoogleCalendarCacheRepository {
  constructor(
    private readonly client: DynamoDBClient,
    private readonly tableName: string,
  ) {}

  async findByUserId(
    userId: string,
  ): Promise<GoogleCalendarCacheRecord | null> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `USER#${userId}`,
          SK: "CACHE#calendar",
        }),
      }),
    );

    if (!result.Item) return null;
    return unmarshall(result.Item) as GoogleCalendarCacheRecord;
  }

  async save(
    userId: string,
    data: Omit<GoogleCalendarCacheRecord, "PK" | "SK">,
  ): Promise<GoogleCalendarCacheRecord> {
    const record: GoogleCalendarCacheRecord = {
      PK: `USER#${userId}`,
      SK: "CACHE#calendar",
      ...data,
      // data.userId を上書きして PK と userId の不一致を防ぐ
      userId,
    };

    // nextEventStartsInMinutes: null は DynamoDB に保存できないため除外して別属性で管理
    // marshall の { removeUndefinedValues: true } を使って null を除外
    const marshalled = marshall(record, { removeUndefinedValues: true });

    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshalled,
      }),
    );

    return record;
  }
}
