import type { ConnectionStatus, ServiceType } from "./enums";

/**
 * Service connection entity
 * DynamoDB: ServiceConnections table
 * PK: USER#<cognitoSub>
 * SK: CONN#<service>
 *
 * Security policy (Q10 answer, aws-constraints.md compliant):
 * - Slack Bot Token is stored in AWS Secrets Manager
 * - This entity stores only secretArn (token itself not stored in DynamoDB)
 */
export interface ServiceConnection {
  /** DynamoDB PK: USER#<cognitoSub> */
  PK: string;
  /** DynamoDB SK: CONN#<service> (e.g., CONN#slack) */
  SK: string;
  /** Service type */
  service: ServiceType;
  /** Connection status */
  status: ConnectionStatus;
  /**
   * Secrets Manager ARN (Q10 answer)
   * Token itself is not stored here — managed by Secrets Manager
   */
  secretArn: string;
  /**
   * Slack user ID captured at OAuth time (e.g., "U12345678").
   * Only present for Slack connections.
   */
  slackUserId?: string;
  /**
   * Slack workspace (team) ID captured at OAuth time (e.g., "T12345678").
   * Only present for Slack connections.
   */
  slackTeamId?: string;
  /**
   * Composite lookup key "<slackTeamId>#<slackUserId>" used as the partition
   * key of GSI-SlackLookup. Lets inbound Slack events resolve back to the
   * owning Cognito user. Only present for Slack connections.
   */
  slackLookupKey?: string;
  /** Connection datetime (ISO 8601) */
  connectedAt: string;
  /** Token expiration (ISO 8601 / null: no expiration) */
  expiresAt: string | null;
}
