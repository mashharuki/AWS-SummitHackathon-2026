import type { TaskCandidate } from "../../types";
import type { ApprovedTask } from "./ITaskRepository";

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
   * @returns Newly created approved Task
   * @throws DynamoWriteFailedError on TransactWriteItems failure
   */
  approve(userId: string, candidateId: string): Promise<ApprovedTask>;

  /**
   * Delete task candidate (when user rejects)
   * DynamoDB: DeleteItem PK=USER#<userId> SK=TASK_CAND#<candidateId>
   */
  delete(userId: string, candidateId: string): Promise<void>;
}
