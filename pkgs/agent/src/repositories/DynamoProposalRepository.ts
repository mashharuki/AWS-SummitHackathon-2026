import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { IProposalRepository, Proposal } from "@saboru/shared";
import { DynamoWriteFailedError } from "@saboru/shared";

/**
 * DynamoDB implementation of IProposalRepository
 *
 * Table design:
 *   PK: TASK#<taskId>
 *   SK: PROPOSAL#<ISO8601 evaluatedAt>
 *
 * GSI (GSI-TaskLatest):
 *   Partition key: taskId
 *   Sort key: evaluatedAt (descending → latest first with ScanIndexForward=false)
 *
 * Idempotency:
 *   PutItem uses ConditionExpression "attribute_not_exists(SK)"
 *   Prevents duplicate writes for same evaluatedAt timestamp.
 *   ConditionalCheckFailedException is silently ignored (existing record wins).
 *
 * Access patterns:
 * - save(): PutItem PK=TASK#<taskId> SK=PROPOSAL#<evaluatedAt>
 * - findLatestByTaskId(): Query GSI-TaskLatest PK=taskId ScanIndexForward=false LIMIT=1
 */
export class DynamoProposalRepository implements IProposalRepository {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor() {
    const ddbClient = new DynamoDBClient({
      region: process.env["AWS_REGION"] ?? "ap-northeast-1",
    });
    this.docClient = DynamoDBDocumentClient.from(ddbClient, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.tableName =
      process.env["DYNAMODB_TABLE_PROPOSALS"] ?? "saborou-proposals-dev";
  }

  /**
   * Save sabori proposal to DynamoDB
   *
   * Builds PK/SK from proposal fields and writes to Proposals table.
   * ConditionExpression prevents duplicate writes (idempotent).
   *
   * @param proposal - Proposal data without PK/SK (built from taskId + evaluatedAt)
   * @returns Persisted Proposal with PK and SK set
   */
  async save(proposal: Omit<Proposal, "PK" | "SK">): Promise<Proposal> {
    const item: Proposal = {
      ...proposal,
      PK: `TASK#${proposal.taskId}`,
      SK: `PROPOSAL#${proposal.evaluatedAt}`,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          // Prevent duplicate writes for same evaluatedAt (idempotency)
          ConditionExpression: "attribute_not_exists(SK)",
        }),
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        // Same PK+SK already exists — idempotent success (existing record wins)
        // Log warning but do not throw
        const existing = await this.findByPkSk(item.PK, item.SK);
        if (existing) {
          return existing;
        }
        // If we couldn't retrieve it, fall through and return the constructed item
        return item;
      }
      throw new DynamoWriteFailedError("Failed to save Proposal", err);
    }

    return item;
  }

  /**
   * Get the latest proposal for a given task
   *
   * Uses GSI-TaskLatest with ScanIndexForward=false (descending by evaluatedAt).
   * Returns null if no proposals exist for the task.
   *
   * @param taskId - Task ID (GSI partition key)
   * @returns Latest Proposal or null
   */
  async findLatestByTaskId(taskId: string): Promise<Proposal | null> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI-TaskLatest",
        KeyConditionExpression: "taskId = :taskId",
        ExpressionAttributeValues: { ":taskId": taskId },
        ScanIndexForward: false, // descending — latest evaluatedAt first
        Limit: 1,
      }),
    );
    const item = result.Items?.[0];
    return item ? (item as Proposal) : null;
  }

  /**
   * Internal: Retrieve existing item by PK+SK (for idempotency fallback)
   */
  private async findByPkSk(pk: string, sk: string): Promise<Proposal | null> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND SK = :sk",
        ExpressionAttributeValues: { ":pk": pk, ":sk": sk },
        Limit: 1,
      }),
    );
    const item = result.Items?.[0];
    return item ? (item as Proposal) : null;
  }
}
