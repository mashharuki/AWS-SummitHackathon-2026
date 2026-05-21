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
  /** Connection datetime (ISO 8601) */
  connectedAt: string;
  /** Token expiration (ISO 8601 / null: no expiration) */
  expiresAt: string | null;
}
