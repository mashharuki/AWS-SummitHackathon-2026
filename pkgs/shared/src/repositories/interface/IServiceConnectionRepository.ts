import type { ServiceConnection, ServiceType } from "../../types";

/**
 * Service connection repository interface
 *
 * Access patterns:
 * - Query PK=USER#<userId> SK begins_with CONN# — Connection list
 * - PutItem — Save connection info at Slack OAuth callback
 * - UpdateItem — Update status=disconnected on disconnect
 */
export interface IServiceConnectionRepository {
  /**
   * Get all service connections for user
   * DynamoDB: Query PK=USER#<userId> SK begins_with CONN#
   * Access pattern: GET /api/connections
   */
  findAllByUserId(userId: string): Promise<ServiceConnection[]>;

  /**
   * Get connection info for specific service
   * DynamoDB: GetItem PK=USER#<userId> SK=CONN#<service>
   */
  findByUserAndService(
    userId: string,
    service: ServiceType,
  ): Promise<ServiceConnection | null>;

  /**
   * Disconnect service (update status=disconnected)
   * DynamoDB: UpdateItem PK=USER#<userId> SK=CONN#<service>
   */
  disconnect(userId: string, service: ServiceType): Promise<void>;
}
