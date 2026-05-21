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
  /** Creation datetime (ISO 8601) */
  createdAt: string;
  /** Update datetime (ISO 8601) */
  updatedAt: string;
}
