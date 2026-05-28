/**
 * ITaskCandidateRepository の DynamoDB 実装
 *
 * アクセスパターン:
 * - Query PK=USER#<userId> SK begins_with TASK_CAND# — findAllByUserId
 * - GetItem — findById
 * - PutItem — create
 * - TransactWriteItems Delete+Put — approve (タスクへのアトミック移行)
 * - DeleteItem — delete (却下)
 */

import {
  DeleteItemCommand,
  type DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type {
  ApproveOverrides,
  ApprovedTask,
  ITaskCandidateRepository,
  Task,
  TaskCandidate,
} from "@saboru/shared";
import {
  DDB_PREFIX,
  DynamoWriteFailedError,
  TASK_CANDIDATE_TTL_DAYS,
  TASK_STATUS,
  generateUlid,
  toIsoString,
} from "@saboru/shared";
import { backfillDecisionAt } from "../utils/decisionAtBackfill.js";

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
        ScanIndexForward: false, // 新しい順に返す
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
    // _userId is an internal field injected by callers that need explicit userId.
    // candidateId.split("#")[0] was previously used but ULID contains no "#",
    // so it returned the full ULID as PK — a critical data corruption bug.
    const extendedCandidate = candidate as Omit<TaskCandidate, "PK" | "SK"> & {
      _userId?: string;
    };
    const userId = extendedCandidate._userId;
    if (!userId) {
      throw new Error(
        "create() requires _userId on the candidate object. Use createForUser() instead.",
      );
    }
    const item: TaskCandidate = {
      PK: `${DDB_PREFIX.USER}${userId}`,
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
    const ttlDays = TASK_CANDIDATE_TTL_DAYS;
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

  async approve(
    userId: string,
    candidateId: string,
    overrides?: ApproveOverrides,
  ): Promise<ApprovedTask> {
    const candidate = await this.findById(userId, candidateId);
    if (!candidate) {
      throw new Error(`TaskCandidate not found: ${candidateId}`);
    }

    const taskId = generateUlid();
    const now = toIsoString(new Date());

    // 承認モーダルでユーザーが編集した値があれば優先する。
    // overrides 未指定／フィールド省略時は候補の元値を使う（後方互換）。
    // plannedSteps は確定済みステップ。空配列／未指定なら保存せず、
    // ガント生成時に Bedrock 分解へフォールバックする。
    const rawPlannedSteps =
      overrides?.plannedSteps && overrides.plannedSteps.length > 0
        ? overrides.plannedSteps
        : undefined;

    // decisionAt 補完: AI が返した decisionAt を最優先し、欠けている場合のみ
    // calcSchedule の後ろ詰め配置時刻で補完して焼き込む。
    // これにより buildCrossTaskDecisionSlots が他タスクの decision を確実に拾える。
    const effectiveDeadline =
      overrides?.deadline !== undefined
        ? overrides.deadline
        : candidate.deadline;
    let plannedSteps = rawPlannedSteps;
    if (rawPlannedSteps && rawPlannedSteps.length > 0) {
      const { steps: backfilled, backfilledCount } = backfillDecisionAt(
        rawPlannedSteps,
        now,
        effectiveDeadline,
      );
      if (backfilledCount > 0) {
        console.log(
          JSON.stringify({
            level: "INFO",
            action: "decision_at_backfilled_on_approve",
            taskId,
            backfilledCount,
            now,
            deadline: effectiveDeadline,
          }),
        );
        plannedSteps = backfilled;
      }
    }

    const task: Task = {
      PK: `${DDB_PREFIX.USER}${userId}`,
      SK: `${DDB_PREFIX.TASK}${taskId}`,
      taskId,
      userId,
      status: TASK_STATUS.APPROVED,
      title: overrides?.title ?? candidate.title,
      deadline:
        overrides?.deadline !== undefined
          ? overrides.deadline
          : candidate.deadline,
      requester: candidate.requester,
      ...(candidate.assignee ? { assignee: candidate.assignee } : {}),
      description: overrides?.description ?? candidate.description,
      sourceType: candidate.sourceType,
      ...(plannedSteps ? { plannedSteps } : {}),
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
