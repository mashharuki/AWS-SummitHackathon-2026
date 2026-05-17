/**
 * DynamoDB implementation of ITaskRepository
 *
 * Access patterns:
 * - Query GSI-UserStatus userId=USER#<userId> status=approved — findApprovedByUserId
 * - GetItem PK=USER#<userId> SK=TASK#<taskId> — findById
 * - PutItem — create
 * - UpdateItem — update, softDelete
 * - putFromTransaction — used by TaskCandidateRepository.approve()
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { ITaskRepository, Task } from "@saboru/shared";
import {
  generateUlid,
  toIsoString,
  DDB_PREFIX,
  TASK_STATUS,
  SOURCE_TYPE,
} from "@saboru/shared";

export class DynamoTaskRepository implements ITaskRepository {
  constructor(
    private readonly client: DynamoDBClient,
    private readonly tableName: string,
  ) {}

  async findApprovedByUserId(userId: string): Promise<Task[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI-UserStatus",
        KeyConditionExpression: "userId = :uid AND #status = :approved",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":uid": userId,
          ":approved": TASK_STATUS.APPROVED,
        }),
        ScanIndexForward: false,
      }),
    );

    return (result.Items ?? []).map((item) => unmarshall(item) as Task);
  }

  async findById(userId: string, taskId: string): Promise<Task | null> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `${DDB_PREFIX.USER}${userId}`,
          SK: `${DDB_PREFIX.TASK}${taskId}`,
        }),
      }),
    );

    if (!result.Item) return null;
    return unmarshall(result.Item) as Task;
  }

  async create(
    task: Omit<
      Task,
      "PK" | "SK" | "taskId" | "status" | "approvedAt" | "updatedAt"
    >,
  ): Promise<Task> {
    const taskId = generateUlid();
    const now = toIsoString(new Date());

    const item: Task = {
      PK: `${DDB_PREFIX.USER}${task.userId}`,
      SK: `${DDB_PREFIX.TASK}${taskId}`,
      taskId,
      status: TASK_STATUS.APPROVED,
      approvedAt: now,
      updatedAt: now,
      ...task,
      // Manual tasks have sourceType=manual and empty requester (applied after spread)
      requester: task.requester ?? "",
      sourceType: task.sourceType ?? SOURCE_TYPE.MANUAL,
    };

    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      }),
    );

    return item;
  }

  async update(
    userId: string,
    taskId: string,
    updates: Partial<Pick<Task, "title" | "deadline" | "description">>,
  ): Promise<Task> {
    const now = toIsoString(new Date());
    const setExpressions: string[] = ["updatedAt = :updatedAt"];
    const expressionAttributeValues: Record<string, unknown> = {
      ":updatedAt": now,
    };
    const expressionAttributeNames: Record<string, string> = {};

    if (updates.title !== undefined) {
      setExpressions.push("#title = :title");
      expressionAttributeNames["#title"] = "title";
      expressionAttributeValues[":title"] = updates.title;
    }
    if (updates.deadline !== undefined) {
      setExpressions.push("deadline = :deadline");
      expressionAttributeValues[":deadline"] = updates.deadline;
    }
    if (updates.description !== undefined) {
      setExpressions.push("#description = :description");
      expressionAttributeNames["#description"] = "description";
      expressionAttributeValues[":description"] = updates.description;
    }

    await this.client.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `${DDB_PREFIX.USER}${userId}`,
          SK: `${DDB_PREFIX.TASK}${taskId}`,
        }),
        UpdateExpression: `SET ${setExpressions.join(", ")}`,
        ExpressionAttributeValues: marshall(expressionAttributeValues, {
          removeUndefinedValues: true,
        }),
        ...(Object.keys(expressionAttributeNames).length > 0
          ? { ExpressionAttributeNames: expressionAttributeNames }
          : {}),
        ConditionExpression: "attribute_exists(PK)",
        ReturnValues: "ALL_NEW",
      }),
    );

    const updated = await this.findById(userId, taskId);
    if (!updated) throw new Error(`Task ${taskId} not found after update`);
    return updated;
  }

  async softDelete(userId: string, taskId: string): Promise<void> {
    const now = toIsoString(new Date());

    await this.client.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: `${DDB_PREFIX.USER}${userId}`,
          SK: `${DDB_PREFIX.TASK}${taskId}`,
        }),
        UpdateExpression: "SET #status = :deleted, updatedAt = :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":deleted": TASK_STATUS.DELETED,
          ":now": now,
        }),
        ConditionExpression: "attribute_exists(PK)",
      }),
    );
  }

  /** Used internally by TransactWriteItems in TaskCandidateRepository.approve() */
  async putFromTransaction(task: Task): Promise<void> {
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(task, { removeUndefinedValues: true }),
      }),
    );
  }
}
