import type { SourceType, TaskCandidateStatus } from "./enums";

/**
 * Task candidate entity
 * DynamoDB: TaskCandidates table
 * PK: USER#<cognitoSub>
 * SK: TASK_CAND#<ulid> (ulidx package, Q4 answer)
 *
 * Design policy (Q1 answer):
 * - TaskCandidate is an independent type for pre-approval candidates
 * - On approval, atomically executed via TransactWriteItems:
 *   TaskCandidates.Delete + Tasks.PutItem
 * - TTL: Auto-deleted by DynamoDB after 30 days
 */
export interface TaskCandidate {
  /** DynamoDB PK: USER#<cognitoSub> */
  PK: string;
  /** DynamoDB SK: TASK_CAND#<ulid> */
  SK: string;
  /** Candidate ID (ULID, extracted from SK) */
  candidateId: string;
  /** Task name (extracted by Bedrock) */
  title: string;
  /** Deadline (ISO 8601 / null: unknown) */
  deadline: string | null;
  /**
   * Requester name (pseudonymized, Q5 answer)
   * Stored as SHA-256 hash. Node.js crypto standard module used.
   */
  requester: string;
  /** Work content summary */
  description: string;
  /** Original data source */
  sourceType: SourceType;
  /**
   * Original message reference ID
   * Raw data (message body) is not stored (privacy design)
   */
  sourceRef: string;
  /** Candidate lifecycle status */
  status: TaskCandidateStatus;
  /** Creation datetime (ISO 8601) */
  createdAt: string;
  /** TTL (Unix timestamp, 30 days after creation) */
  ttl: number;
}
