/**
 * IServiceConnectionRepository の DynamoDB 実装
 *
 * アクセスパターン:
 * - Query PK=USER#<userId> SK begins_with CONN# — findAllByUserId
 * - GetItem PK=USER#<userId> SK=CONN#<service> — findByUserAndService
 * - PutItem — save
 * - UpdateItem status=disconnected — disconnect
 * - Query GSI-SlackLookup PK=<teamId>#<slackUserId> — findCognitoSubBySlackIdentity
 */

/** Slack identity を GSI-SlackLookup の合成パーティションキーに変換する */
export function buildSlackLookupKey(
  slackTeamId: string,
  slackUserId: string,
): string {
  return `${slackTeamId}#${slackUserId}`;
}

import {
  type DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type {
  IServiceConnectionRepository,
  ServiceConnection,
  ServiceType,
} from "@saboru/shared";
import { toIsoString } from "@saboru/shared";

export class DynamoServiceConnectionRepository
  implements IServiceConnectionRepository
{
  constructor(
    private readonly client: DynamoDBClient,
    private readonly tableName: string,
  ) {}

  async findAllByUserId(userId: string): Promise<ServiceConnection[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: marshall({
          ":pk": `USER#${userId}`,
          ":prefix": "CONN#",
        }),
      }),
    );

    return (result.Items ?? []).map(
      (item) => unmarshall(item) as ServiceConnection,
    );
  }

  async findByUserAndService(
    userId: string,
    service: ServiceType,
  ): Promise<ServiceConnection | null> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `USER#${userId}`,
          SK: `CONN#${service}`,
        }),
      }),
    );

    if (!result.Item) return null;
    return unmarshall(result.Item) as ServiceConnection;
  }

  /**
   * Save connection with explicit userId (U-04 internal helper).
   * The interface IServiceConnectionRepository.save() does not carry userId,
   * so routes call this extended method directly on the concrete class.
   */
  async saveForUser(
    userId: string,
    // connectedAt は省略可能（省略時は現在時刻で補完する）
    connection: Omit<ServiceConnection, "PK" | "SK" | "connectedAt"> & {
      connectedAt?: string;
    },
  ): Promise<ServiceConnection> {
    // Slack identity が揃っていれば GSI-SlackLookup 用の合成キーを導出する。
    // 既存呼び出し（slackUserId/slackTeamId 未指定）との互換のため、揃った場合のみ付与。
    const slackLookupKey =
      connection.slackTeamId && connection.slackUserId
        ? buildSlackLookupKey(connection.slackTeamId, connection.slackUserId)
        : connection.slackLookupKey;

    const item: ServiceConnection = {
      PK: `USER#${userId}`,
      SK: `CONN#${connection.service}`,
      ...connection,
      ...(slackLookupKey ? { slackLookupKey } : {}),
      connectedAt: connection.connectedAt ?? toIsoString(new Date()),
    };

    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      }),
    );

    return item;
  }

  /**
   * Slack identity から所有 Cognito ユーザー (cognitoSub) を逆引きする。
   * GSI-SlackLookup (PK=slackLookupKey, KEYS_ONLY) を引き、ヒットした
   * テーブル PK "USER#<cognitoSub>" から cognitoSub を復元する。
   *
   * @returns cognitoSub。連携済みユーザーが見つからなければ null。
   */
  async findCognitoSubBySlackIdentity(
    slackTeamId: string,
    slackUserId: string,
  ): Promise<string | null> {
    const lookupKey = buildSlackLookupKey(slackTeamId, slackUserId);
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI-SlackLookup",
        KeyConditionExpression: "slackLookupKey = :k",
        ExpressionAttributeValues: marshall({ ":k": lookupKey }),
        Limit: 1,
      }),
    );

    const item = result.Items?.[0];
    if (!item) return null;
    const { PK } = unmarshall(item) as { PK: string };
    // PK 形式: "USER#<cognitoSub>"
    return PK.startsWith("USER#") ? PK.slice("USER#".length) : null;
  }

  async disconnect(userId: string, service: ServiceType): Promise<void> {
    await this.client.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `USER#${userId}`,
          SK: `CONN#${service}`,
        }),
        UpdateExpression: "SET #status = :disconnected",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":disconnected": "disconnected",
        }),
      }),
    );
  }
}
