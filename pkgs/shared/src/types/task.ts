import type { SourceType, TaskStatus } from "./enums";

/**
 * Task entity (approved)
 * DynamoDB: Tasks table
 * PK: USER#<cognitoSub>
 * SK: TASK#<ulid> (ulidx package, Q4 answer)
 *
 * Design policy (Q1 answer):
 * - Task is an independent type for approved tasks
 * - A new ULID is assigned when converting from TaskCandidate
 * - No physical deletion — logical deletion with status=deleted
 */
export interface Task {
  /** DynamoDB PK: USER#<cognitoSub> */
  PK: string;
  /** DynamoDB SK: TASK#<ulid> */
  SK: string;
  /** Task ID (ULID, extracted from SK) */
  taskId: string;
  /** User ID for GSI */
  userId: string;
  /** Task status */
  status: TaskStatus;
  /** Task name */
  title: string;
  /** Deadline (ISO 8601 / null: unknown) */
  deadline: string | null;
  /**
   * Requester name (pseudonymized, Q5 answer)
   * SHA-256 hashed
   */
  requester: string;
  /** Work content */
  description: string;
  /** Original data source */
  sourceType: SourceType;
  /** Approval datetime (ISO 8601) */
  approvedAt: string;
  /** Update datetime (ISO 8601) */
  updatedAt: string;
}
