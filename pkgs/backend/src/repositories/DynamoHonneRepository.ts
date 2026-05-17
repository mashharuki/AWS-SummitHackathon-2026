/**
 * IHonneRepository の DynamoDB 実装
 *
 * アクセスパターン:
 * - PutItem PK=USER#<userId> SK=HONNE#<ISO8601> — save
 * - Query GSI-UserCreatedAt PK=USER#<userId> — findAllByUserId (将来構想)
 */

import {
  type DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { HonneData, IHonneRepository } from "@saboru/shared";
import { DDB_PREFIX, toIsoString } from "@saboru/shared";

export class DynamoHonneRepository implements IHonneRepository {
  constructor(
    private readonly client: DynamoDBClient,
    private readonly tableName: string,
  ) {}

  async save(honneData: Omit<HonneData, "PK" | "SK">): Promise<HonneData> {
    const createdAt = honneData.createdAt ?? toIsoString(new Date());

    const item: HonneData = {
      PK: `${DDB_PREFIX.USER}${honneData.userId}`,
      SK: `HONNE#${createdAt}`,
      ...honneData,
      createdAt,
    };

    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      }),
    );

    return item;
  }

  async findAllByUserId(userId: string): Promise<HonneData[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: marshall({
          ":pk": `${DDB_PREFIX.USER}${userId}`,
          ":prefix": "HONNE#",
        }),
        ScanIndexForward: false,
      }),
    );

    return (result.Items ?? []).map((item) => unmarshall(item) as HonneData);
  }
}
