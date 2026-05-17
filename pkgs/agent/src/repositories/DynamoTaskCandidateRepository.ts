import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  ApprovedTask,
  ITaskCandidateRepository,
  Task,
  TaskCandidate,
} from "@saboru/shared";
import {
  DDB_PREFIX,
  DynamoWriteFailedError,
  TASK_STATUS,
  generateUlid,
  toIsoString,
} from "@saboru/shared";

/**
 * DynamoDB implementation of ITaskCandidateRepository (DP-05)
 *
 * Table design:
 *   PK: USER#<cognitoSub>
 *   SK: TASK_CAND#<ulid>
 *
 * Idempotency (DP-05):
 *   PutItem uses ConditionExpression "attribute_not_exists(SK)"
 *   to prevent duplicate writes for the same ULID.
 *   True at-most-once for the same messageTs requires caller-side dedup
 *   (or a GSI on sourceRef). MVP scope: DLQ monitoring covers duplicates.
 */
export class DynamoTaskCandidateRepository implements ITaskCandidateRepository {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly candidatesTable: string;
  private readonly tasksTable: string;

  constructor() {
    const ddbClient = new DynamoDBClient({
      region: process.env["AWS_REGION"] ?? "ap-northeast-1",
    });
    this.docClient = DynamoDBDocumentClient.from(ddbClient, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.candidatesTable =
      process.env["DYNAMODB_TABLE_TASK_CANDIDATES"] ??
      "saborou-task-candidates-dev";
    this.tasksTable =
      process.env["DYNAMODB_TABLE_TASKS"] ?? "saborou-tasks-dev";
  }

  async findAllByUserId(userId: string): Promise<TaskCandidate[]> {
    const pk = `${DDB_PREFIX.USER}${userId}`;
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.candidatesTable,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": pk,
          ":prefix": DDB_PREFIX.TASK_CAND,
        },
        ScanIndexForward: false, // newest first
      }),
    );
    return (result.Items ?? []) as TaskCandidate[];
  }

  async findById(
    userId: string,
    candidateId: string,
  ): Promise<TaskCandidate | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.candidatesTable,
        Key: {
          PK: `${DDB_PREFIX.USER}${userId}`,
          SK: `${DDB_PREFIX.TASK_CAND}${candidateId}`,
        },
      }),
    );
    return result.Item ? (result.Item as TaskCandidate) : null;
  }

  async create(
    candidate: Omit<TaskCandidate, "PK" | "SK">,
  ): Promise<TaskCandidate> {
    // Note: ITaskCandidateRepository.create() does not accept userId directly.
    // TaskExtractorAgent uses createTaskCandidateWithUserId() which injects
    // _userId as an internal convention so the repository can build PK=USER#<userId>.

    // Extract userId if provided (agent-internal convention)
    const extendedCandidate = candidate as Omit<TaskCandidate, "PK" | "SK"> & {
      _userId?: string;
    };
    const userId = extendedCandidate._userId ?? candidate.candidateId;
    // Clean up internal field
    const { _userId: _removed, ...cleanCandidate } = extendedCandidate;

    const item: TaskCandidate = {
      ...cleanCandidate,
      PK: `${DDB_PREFIX.USER}${userId}`,
      SK: `${DDB_PREFIX.TASK_CAND}${candidate.candidateId}`,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.candidatesTable,
          Item: item,
          ConditionExpression: "attribute_not_exists(SK)", // DP-05: idempotency
        }),
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        // Same ULID already exists — idempotent success
        const existing = await this.findById(userId, candidate.candidateId);
        if (existing) return existing;
      }
      throw new DynamoWriteFailedError("Failed to create TaskCandidate", err);
    }

    return item;
  }

  async approve(userId: string, candidateId: string): Promise<ApprovedTask> {
    const candidatePk = `${DDB_PREFIX.USER}${userId}`;
    const candidateSk = `${DDB_PREFIX.TASK_CAND}${candidateId}`;

    // Fetch candidate first to get its data
    const candidate = await this.findById(userId, candidateId);
    if (!candidate) {
      throw new DynamoWriteFailedError(
        `TaskCandidate not found: ${candidateId}`,
      );
    }

    const now = new Date();
    const taskId = generateUlid();
    const task: Task = {
      PK: candidatePk,
      SK: `${DDB_PREFIX.TASK}${taskId}`,
      taskId,
      userId,
      status: TASK_STATUS.APPROVED,
      title: candidate.title,
      deadline: candidate.deadline,
      requester: candidate.requester,
      description: candidate.description,
      sourceType: candidate.sourceType,
      approvedAt: toIsoString(now),
      updatedAt: toIsoString(now),
    };

    try {
      await this.docClient.send(
        new TransactWriteItemsCommand({
          TransactItems: [
            {
              // Delete the candidate
              Delete: {
                TableName: this.candidatesTable,
                Key: {
                  PK: { S: candidatePk },
                  SK: { S: candidateSk },
                },
                ConditionExpression: "attribute_exists(SK)",
              },
            },
            {
              // Create the approved task
              Put: {
                TableName: this.tasksTable,
                Item: {
                  PK: { S: task.PK },
                  SK: { S: task.SK },
                  taskId: { S: task.taskId },
                  userId: { S: task.userId },
                  status: { S: task.status },
                  title: { S: task.title },
                  ...(task.deadline ? { deadline: { S: task.deadline } } : {}),
                  requester: { S: task.requester },
                  description: { S: task.description },
                  sourceType: { S: task.sourceType },
                  approvedAt: { S: task.approvedAt },
                  updatedAt: { S: task.updatedAt },
                },
                ConditionExpression: "attribute_not_exists(SK)",
              },
            },
          ],
        }),
      );
    } catch (err) {
      throw new DynamoWriteFailedError("Failed to approve TaskCandidate", err);
    }

    return task;
  }

  async delete(userId: string, candidateId: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.candidatesTable,
        Key: {
          PK: `${DDB_PREFIX.USER}${userId}`,
          SK: `${DDB_PREFIX.TASK_CAND}${candidateId}`,
        },
      }),
    );
  }
}

/**
 * Internal helper: Create a TaskCandidate with explicit userId.
 * Used by TaskExtractorAgent to bypass the PK derivation issue.
 *
 * This function wraps create() and injects _userId into the payload
 * so the repository can build PK=USER#<userId>.
 */
export async function createTaskCandidateWithUserId(
  repo: ITaskCandidateRepository,
  userId: string,
  candidate: Omit<TaskCandidate, "PK" | "SK">,
): Promise<TaskCandidate> {
  // Inject _userId as internal convention
  return repo.create({
    ...candidate,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _userId: userId,
  } as any);
}
