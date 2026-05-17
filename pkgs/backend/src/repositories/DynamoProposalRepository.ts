/**
 * DynamoDB implementation of IProposalRepository
 *
 * Access patterns:
 * - Query GSI-TaskLatest PK=TASK#<taskId> ScanIndexForward=false LIMIT=1 — findLatestByTaskId
 * - PutItem — save (called by SaboriProposerAgent)
 *
 * Note: This repository is READ-ONLY from the API perspective.
 * Writes are performed by SaboriProposerAgent (U-03b), not by U-04 routes.
 * The API only reads the latest proposal to display to the user.
 */

import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { IProposalRepository, Proposal } from "@saboru/shared";

export class DynamoProposalRepository implements IProposalRepository {
  constructor(
    private readonly client: DynamoDBClient,
    private readonly tableName: string,
  ) {}

  async findLatestByTaskId(taskId: string): Promise<Proposal | null> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI-TaskLatest",
        KeyConditionExpression: "taskId = :taskId",
        ExpressionAttributeValues: marshall({ ":taskId": taskId }),
        ScanIndexForward: false,
        Limit: 1,
      }),
    );

    if (!result.Items || result.Items.length === 0) return null;
    return unmarshall(result.Items[0]) as Proposal;
  }

  async save(proposal: Omit<Proposal, "PK" | "SK">): Promise<Proposal> {
    const item: Proposal = {
      PK: `TASK#${proposal.taskId}`,
      SK: `PROPOSAL#${proposal.evaluatedAt}`,
      ...proposal,
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
