import type { SourceType, TaskStatus } from "./enums";
import type { ScheduleStep } from "./schedule";

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
   * Requester display name (who asked).
   * 候補から引き継ぐ表示名。users.info で解決済み、未解決なら Slack user ID。
   */
  requester: string;
  /**
   * Assignee display name (who it was asked to).
   * 候補から引き継ぐ。メンションが無い場合は未設定（自分宛）。
   */
  assignee?: string;
  /** Work content */
  description: string;
  /** Original data source */
  sourceType: SourceType;
  /**
   * User-confirmed work steps (set via the approval modal).
   *
   * When present and non-empty, gantt generation reuses these steps directly
   * and skips the Bedrock step-decomposition phase, guaranteeing that the
   * gantt matches what the user confirmed. Absent/empty for legacy tasks
   * approved before this feature, which fall back to Bedrock inference.
   */
  plannedSteps?: ScheduleStep[];
  /** Approval datetime (ISO 8601) */
  approvedAt: string;
  /** Update datetime (ISO 8601) */
  updatedAt: string;
}
