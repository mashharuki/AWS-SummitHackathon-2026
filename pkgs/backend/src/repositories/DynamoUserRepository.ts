/**
 * DynamoDB implementation of IUserRepository
 *
 * Access patterns:
 * - GetItem PK=USER#<cognitoSub> SK=PROFILE — findById
 * - PutItem PK=USER#<cognitoSub> SK=PROFILE — upsert
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { IUserRepository, User } from "@saboru/shared";
import { toIsoString } from "@saboru/shared";

export class DynamoUserRepository implements IUserRepository {
  private readonly client: DynamoDBClient;
  private readonly tableName: string;

  constructor(client: DynamoDBClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  async findById(cognitoSub: string): Promise<User | null> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `USER#${cognitoSub}`,
          SK: "PROFILE",
        }),
      }),
    );

    if (!result.Item) return null;
    return unmarshall(result.Item) as User;
  }

  async upsert(user: Omit<User, "PK" | "SK">): Promise<User> {
    const now = toIsoString(new Date());
    const item: User = {
      PK: `USER#${user.cognitoSub}`,
      SK: "PROFILE",
      ...user,
      updatedAt: now,
      createdAt: user.createdAt ?? now,
    };

    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      }),
    );

    return item;
  }
}
