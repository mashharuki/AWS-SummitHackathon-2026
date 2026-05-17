import type { User } from "../types";

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
}
