import type { ScheduleStep, TaskCandidate } from "../../types";
import type { ApprovedTask } from "./ITaskRepository";

/**
 * Values that override the candidate's fields when approving.
 *
 * Produced by the approval-confirmation modal where the user reviews and edits
 * the task before it becomes a Task. All fields optional — omitted fields keep
 * the candidate's original value (backward compatible). `plannedSteps`, when
 * present, is the user-confirmed step list persisted to the Task so that gantt
 * generation can skip Bedrock re-inference.
 *
 * The exact request-body validation lives in `ApproveOverridesSchema`
 * (schemas/task.ts); this structural type is what the repository layer consumes.
 */
export interface ApproveOverrides {
  title?: string;
  deadline?: string | null;
  description?: string;
  plannedSteps?: ScheduleStep[];
}

/**
 * Task candidate repository interface
 *
 * Access patterns:
 * - Query PK=USER#<userId> SK begins_with TASK_CAND# — Candidate list (newest first)
 * - PutItem — Save candidate on Slack Webhook reception
 * - TransactWriteItems Delete — Delete candidate on approval (atomic migration to Tasks)
 * - DeleteItem — Reject candidate
 */
export interface ITaskCandidateRepository {
  /**
   * Get task candidate list (newest first)
   * DynamoDB: Query PK=USER#<userId> SK begins_with TASK_CAND#
   * GSI-UserCreatedAt for createdAt descending sort
   * Access pattern: GET /api/tasks (candidates)
   */
  findAllByUserId(userId: string): Promise<TaskCandidate[]>;

  /**
   * Get single task candidate
   * DynamoDB: GetItem PK=USER#<userId> SK=TASK_CAND#<candidateId>
   */
  findById(userId: string, candidateId: string): Promise<TaskCandidate | null>;

  /**
   * Create task candidate (on Webhook reception)
   * DynamoDB: PutItem PK=USER#<userId> SK=TASK_CAND#<ulid>
   * ULID generated with generateUlid() (BR-04)
   * requester must be pseudonymized with pseudonymize() (BR-05)
   * TTL set to 30 days after creation (BR-13)
   */
  create(candidate: Omit<TaskCandidate, "PK" | "SK">): Promise<TaskCandidate>;

  /**
   * Approve task candidate and atomically migrate to Tasks table
   * DynamoDB: TransactWriteItems (Delete TaskCandidates + PutItem Tasks)
   * Approved Task has a new ULID (BR-04)
   * Access pattern: POST /api/tasks/candidates/:id/approve
   *
   * @param overrides Optional user edits from the approval modal. Omitted
   *   fields fall back to the candidate's values (backward compatible).
   * @returns Newly created approved Task
   * @throws DynamoWriteFailedError on TransactWriteItems failure
   */
  approve(
    userId: string,
    candidateId: string,
    overrides?: ApproveOverrides,
  ): Promise<ApprovedTask>;

  /**
   * Delete task candidate (when user rejects)
   * DynamoDB: DeleteItem PK=USER#<userId> SK=TASK_CAND#<candidateId>
   */
  delete(userId: string, candidateId: string): Promise<void>;
}
