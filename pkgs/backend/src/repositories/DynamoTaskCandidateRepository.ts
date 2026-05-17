/**
 * DynamoDB implementation of ITaskCandidateRepository
 *
 * Access patterns:
 * - Query PK=USER#<userId> SK begins_with TASK_CAND# — findAllByUserId
 * - GetItem — findById
 * - PutItem — create
 * - TransactWriteItems Delete+Put — approve (atomic migration to Tasks)
 * - DeleteItem — delete (rejection)
 */

import {
  DynamoDBClient,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type {
  ITaskCandidateRepository,
  TaskCandidate,
  Task,
} from "@saboru/shared";
import {
  generateUlid,
  toIsoString,
  DynamoWriteFailedError,
  TASK_CANDIDATE_TTL_DAYS,
  DDB_PREFIX,
  TASK_STATUS,
  SOURCE_TYPE,
} from "@saboru/shared";
import type { ApprovedTask } from "@saboru/shared";

export class DynamoTaskCandidateRepository implements ITaskCandidateRepository {
  constructor(
    private readonly client: DynamoDBClient,
    private readonly candidatesTableName: string,
    private readonly tasksTableName: string,
  ) {}

  async findAllByUserId(userId: string): Promise<TaskCandidate[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.candidatesTableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: marshall({
          ":pk": `${DDB_PREFIX.USER}${userId}`,
          ":prefix": DDB_PREFIX.TASK_CAND,
        }),
        ScanIndexForward: false, // newest first
      }),
    );

    return (result.Items ?? []).map(
      (item) => unmarshall(item) as TaskCandidate,
    );
  }

  async findById(
    userId: string,
    candidateId: string,
  ): Promise<TaskCandidate | null> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.candidatesTableName,
        Key: marshall({
          PK: `${DDB_PREFIX.USER}${userId}`,
          SK: `${DDB_PREFIX.TASK_CAND}${candidateId}`,
        }),
      }),
    );

    if (!result.Item) return null;
    return unmarshall(result.Item) as TaskCandidate;
  }

  async create(
    candidate: Omit<TaskCandidate, "PK" | "SK">,
  ): Promise<TaskCandidate> {
    const item: TaskCandidate = {
      PK: `${DDB_PREFIX.USER}${candidate.candidateId.split("#")[0] ?? "unknown"}`,
      SK: `${DDB_PREFIX.TASK_CAND}${candidate.candidateId}`,
      ...candidate,
    };

    await this.client.send(
      new PutItemCommand({
        TableName: this.candidatesTableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      }),
    );

    return item;
  }

  /**
   * createForUser — U-04 internal helper
   * Creates a task candidate with explicit userId (not derivable from interface alone).
   */
  async createForUser(
    userId: string,
    candidate: Omit<
      TaskCandidate,
      "PK" | "SK" | "candidateId" | "createdAt" | "ttl"
    >,
  ): Promise<TaskCandidate> {
    const candidateId = generateUlid();
    const now = toIsoString(new Date());
    const ttlDays = TASK_CANDIDATE_TTL_DAYS ?? 30;
    const ttl = Math.floor(Date.now() / 1000) + ttlDays * 86400;

    const item: TaskCandidate = {
      PK: `${DDB_PREFIX.USER}${userId}`,
      SK: `${DDB_PREFIX.TASK_CAND}${candidateId}`,
      candidateId,
      createdAt: now,
      ttl,
      ...candidate,
    };

    await this.client.send(
      new PutItemCommand({
        TableName: this.candidatesTableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      }),
    );

    return item;
  }

  async approve(userId: string, candidateId: string): Promise<ApprovedTask> {
    const candidate = await this.findById(userId, candidateId);
    if (!candidate) {
      throw new Error(`TaskCandidate not found: ${candidateId}`);
    }

    const taskId = generateUlid();
    const now = toIsoString(new Date());

    const task: Task = {
      PK: `${DDB_PREFIX.USER}${userId}`,
      SK: `${DDB_PREFIX.TASK}${taskId}`,
      taskId,
      userId,
      status: TASK_STATUS.APPROVED,
      title: candidate.title,
      deadline: candidate.deadline,
      requester: candidate.requester,
      description: candidate.description,
      sourceType: candidate.sourceType,
      approvedAt: now,
      updatedAt: now,
    };

    try {
      await this.client.send(
        new TransactWriteItemsCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.candidatesTableName,
                Key: marshall({
                  PK: candidate.PK,
                  SK: candidate.SK,
                }),
              },
            },
            {
              Put: {
                TableName: this.tasksTableName,
                Item: marshall(task, { removeUndefinedValues: true }),
              },
            },
          ],
        }),
      );
    } catch (err) {
      throw new DynamoWriteFailedError(
        `TransactWriteItems failed for candidate ${candidateId}: ${String(err)}`,
      );
    }

    return task;
  }

  async delete(userId: string, candidateId: string): Promise<void> {
    await this.client.send(
      new DeleteItemCommand({
        TableName: this.candidatesTableName,
        Key: marshall({
          PK: `${DDB_PREFIX.USER}${userId}`,
          SK: `${DDB_PREFIX.TASK_CAND}${candidateId}`,
        }),
      }),
    );
  }
}
