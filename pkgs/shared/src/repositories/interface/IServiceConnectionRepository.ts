import type { ServiceConnection, ServiceType } from "../../types";

/**
 * Service connection repository interface
 *
 * Access patterns:
 * - Query PK=USER#<userId> SK begins_with CONN# — Connection list
 * - PutItem — Save connection info at Slack OAuth callback
 * - UpdateItem — Update status=disconnected on disconnect
 * - Query GSI-SlackLookup PK=<teamId>#<slackUserId> — Resolve Cognito user
 *   from an inbound Slack identity
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

  /**
   * Resolve the owning Cognito user (cognitoSub) from a Slack identity.
   * DynamoDB: Query GSI-SlackLookup PK=<teamId>#<slackUserId>
   * Used by the TaskExtractor to map inbound Slack events to a Cognito user.
   *
   * @returns cognitoSub, or null if no connected user matches
   */
  findCognitoSubBySlackIdentity(
    slackTeamId: string,
    slackUserId: string,
  ): Promise<string | null>;
}
