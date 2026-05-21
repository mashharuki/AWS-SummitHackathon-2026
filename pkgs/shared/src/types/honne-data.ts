import type { HonneType, QuickReplyType, Verdict } from "./enums";

/**
 * Honne data entity (user's true reaction data)
 * DynamoDB: HonneData table
 * PK: USER#<cognitoSub>
 * SK: HONNE#<ISO8601>
 *
 * FR-05 compliance: Persistent storage of user's true reaction data
 * Will be raw material for future "user manual" generation
 * (MVP v1.0.0: presented as future vision only)
 */
export interface HonneData {
  /** DynamoDB PK: USER#<cognitoSub> */
  PK: string;
  /** DynamoDB SK: HONNE#<ISO8601> */
  SK: string;
  /** User ID for GSI */
  userId: string;
  /** Related task ID */
  taskId: string;
  /** Reaction type */
  type: HonneType;
  /**
   * Reaction content
   * - type='quick_reply': QuickReplyType value
   * - type='free_text': Free text entered by user
   */
  content: QuickReplyType | string;
  /** Sabori verdict at time of recording (context preservation) */
  proposalVerdict: Verdict;
  /** Creation datetime (ISO 8601) */
  createdAt: string;
}
