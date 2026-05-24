/**
 * User entity
 * DynamoDB: Users table
 * PK: USER#<cognitoSub>
 * SK: PROFILE
 */
export interface User {
  /** DynamoDB PK: USER#<cognitoSub> */
  PK: string;
  /** DynamoDB SK: PROFILE (fixed value) */
  SK: "PROFILE";
  /** Cognito Sub (UUID) */
  cognitoSub: string;
  /** Email address */
  email: string;
  /** Display name */
  name: string;
  /**
   * Linked Slack user ID (e.g., "U12345678").
   * Set when the user completes Slack OAuth. Used to map inbound Slack
   * events back to this Cognito user.
   */
  slackUserId?: string;
  /**
   * Linked Slack workspace (team) ID (e.g., "T12345678").
   * Combined with slackUserId to uniquely identify the Slack identity.
   */
  slackTeamId?: string;
  /**
   * Preferred AI persona ID (e.g., "saboru_ottori").
   * Controls the tone of sabori proposals. Defaults to DEFAULT_PERSONA_ID
   * when unset. Must be one of VALID_PERSONA_IDS.
   */
  preferredPersonaId?: string;
  /** Creation datetime (ISO 8601) */
  createdAt: string;
  /** Update datetime (ISO 8601) */
  updatedAt: string;
  /** AI dependency score (0-100). Starts at 100, decreases as user relies on AI judgements. */
  dependencyScore?: number;
}
