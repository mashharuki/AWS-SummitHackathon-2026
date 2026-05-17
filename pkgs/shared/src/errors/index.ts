import { AppError } from "./AppError";

/**
 * Bedrock converse API timeout (NFR-01: 5 second limit)
 * On timeout, user is shown "retry" toast notification
 */
export class BedrockTimeoutError extends AppError {
  constructor(message = "Bedrock API response timed out (5s limit)") {
    super("BEDROCK_TIMEOUT", message, 504);
    this.name = "BedrockTimeoutError";
  }
}

/**
 * Bedrock token cost limit exceeded (NFR-06: $50/month limit)
 * Prevented in advance by guardTokenLimit() preflight check
 * On limit exceeded: graceful degradation (task displayed without proposal)
 */
export class BedrockCostExceededError extends AppError {
  constructor(message = "Bedrock token cost limit exceeded") {
    super("BEDROCK_COST_EXCEEDED", message, 429);
    this.name = "BedrockCostExceededError";
  }
}

/**
 * Cognito JWT expired
 * Frontend attempts auto-refresh on 401 reception
 */
export class TokenExpiredError extends AppError {
  constructor(message = "Cognito JWT token expired") {
    super("TOKEN_EXPIRED", message, 401);
    this.name = "TokenExpiredError";
  }
}

/**
 * DynamoDB write failure
 * Wraps TransactWriteItems ConditionalCheckFailedException etc.
 */
export class DynamoWriteFailedError extends AppError {
  constructor(message = "DynamoDB write operation failed", details?: unknown) {
    super("DYNAMO_WRITE_FAILED", message, 500, details);
    this.name = "DynamoWriteFailedError";
  }
}

/**
 * Type guard: narrows unknown type to AppError safely
 *
 * @example
 * try {
 *   await repo.save(data);
 * } catch (e) {
 *   if (isAppError(e)) {
 *     logger.error({ code: e.code, details: e.details });
 *     return res.status(e.statusCode).json(e.serialize());
 *   }
 *   throw e; // Unknown errors propagate upward
 * }
 */
export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

// Re-exports
export { AppError };
export type { ErrorCode, SerializedError } from "./AppError";
