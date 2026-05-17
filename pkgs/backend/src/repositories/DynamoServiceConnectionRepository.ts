/**
 * DynamoDB implementation of IServiceConnectionRepository
 *
 * Access patterns:
 * - Query PK=USER#<userId> SK begins_with CONN# — findAllByUserId
 * - GetItem PK=USER#<userId> SK=CONN#<service> — findByUserAndService
 * - PutItem — save
 * - UpdateItem status=disconnected — disconnect
 */

import {
  DynamoDBClient,
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

  async save(
    connection: Omit<ServiceConnection, "PK" | "SK">,
  ): Promise<ServiceConnection> {
    const _item: ServiceConnection = {
      ...connection,
      PK: `USER#${connection.service}`,
      SK: `CONN#${connection.service}`,
    };
    void _item;

    // Build proper PK from the userId — connection.secretArn is not userId.
    // We need userId from the caller. Since IServiceConnectionRepository.save()
    // receives `Omit<ServiceConnection, "PK" | "SK">`, we derive userId from
    // the secretArn pattern or a dedicated field if provided.
    // For U-04 the routes pass userId via a wrapper — reconstruct here safely.
    const conn: ServiceConnection = {
      PK: `USER#${connection.secretArn}`, // placeholder; overridden by save wrapper
      SK: `CONN#${connection.service}`,
      ...connection,
    };
    void conn; // unused — see saveForUser below

    throw new Error(
      "Use saveForUser() — IServiceConnectionRepository.save() requires userId",
    );
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
