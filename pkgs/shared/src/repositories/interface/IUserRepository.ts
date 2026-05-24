import type { User } from "../../types";

/**
 * User repository interface
 *
 * Access patterns:
 * - GetItem PK=USER#<cognitoSub> SK=PROFILE — Profile retrieval at login
 * - PutItem PK=USER#<cognitoSub> SK=PROFILE — Record creation at first login
 */
export interface IUserRepository {
  /**
   * Get user by ID
   * DynamoDB: GetItem PK=USER#<cognitoSub> SK=PROFILE
   *
   * @returns User info, or null if not found
   */
  findById(cognitoSub: string): Promise<User | null>;

  /**
   * Create or overwrite user (at first login)
   * DynamoDB: PutItem PK=USER#<cognitoSub> SK=PROFILE
   */
  upsert(user: Omit<User, "PK" | "SK">): Promise<User>;

  /**
   * Get current AI dependency score (0-100). Returns 100 if not yet set.
   * DynamoDB: GetItem PK=USER#<cognitoSub> SK=PROFILE → dependencyScore
   */
  getDependencyScore(cognitoSub: string): Promise<number>;

  /**
   * Decrement AI dependency score by delta. Floors at 0.
   * DynamoDB: UpdateItem PK=USER#<cognitoSub> SK=PROFILE
   * @returns New score after decrement
   */
  decrementDependencyScore(cognitoSub: string, delta: number): Promise<number>;
}
