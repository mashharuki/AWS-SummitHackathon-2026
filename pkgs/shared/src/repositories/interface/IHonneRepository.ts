import type { HonneData } from "../../types";

/**
 * Honne data repository interface
 *
 * Access patterns:
 * - PutItem PK=USER#<userId> SK=HONNE#<ISO8601>
 * - Query GSI-UserCreatedAt PK=USER#<userId>
 */
export interface IHonneRepository {
  /**
   * Save honne data
   * DynamoDB: PutItem PK=USER#<userId> SK=HONNE#<ISO8601>
   * Access pattern: POST /api/tasks/:id/honne (FR-05)
   */
  save(honneData: Omit<HonneData, "PK" | "SK">): Promise<HonneData>;

  /**
   * Get user's honne history
   * (Future vision: for "user manual" generation)
   * DynamoDB: Query GSI-UserCreatedAt PK=USER#<userId>
   * MVP v1.0.0: not displayed in UI (out of AG-05 scope)
   */
  findAllByUserId(userId: string): Promise<HonneData[]>;
}
