/**
 * IServiceConnectionRepository の DynamoDB 実装
 *
 * アクセスパターン:
 * - Query PK=USER#<userId> SK begins_with CONN# — findAllByUserId
 * - GetItem PK=USER#<userId> SK=CONN#<service> — findByUserAndService
 * - PutItem — save
 * - UpdateItem status=disconnected — disconnect
 */

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
    connection: Omit<ServiceConnection, "PK" | "SK">,
  ): Promise<ServiceConnection> {
    const item: ServiceConnection = {
      PK: `USER#${userId}`,
      SK: `CONN#${connection.service}`,
      ...connection,
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
