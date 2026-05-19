import type { Proposal } from "../../types";

/**
 * Proposal repository interface
 *
 * Access patterns:
 * - Query GSI-TaskLatest PK=TASK#<taskId> ScanIndexForward=false LIMIT=1
 * - PutItem — SaboriProposerAgent writes on proposal generation
 */
export interface IProposalRepository {
  /**
   * Get latest proposal for specified task
   * DynamoDB: Query GSI-TaskLatest PK=TASK#<taskId> ScanIndexForward=false LIMIT=1
   * Access pattern: GET /api/tasks/:id/proposal
   *
   * @returns Latest proposal, or null if not found
   */
  findLatestByTaskId(taskId: string): Promise<Proposal | null>;

  /**
   * Save sabori proposal (called by SaboriProposerAgent)
   * DynamoDB: PutItem PK=TASK#<taskId> SK=PROPOSAL#<ISO8601>
   * SK ISO8601 uses value of evaluatedAt (sort key for GSI-TaskLatest)
   */
  save(proposal: Omit<Proposal, "PK" | "SK">): Promise<Proposal>;
}
