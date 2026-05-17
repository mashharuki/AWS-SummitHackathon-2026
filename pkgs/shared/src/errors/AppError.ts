/**
 * Application-specific error codes
 * Hono error handler reads code to convert to appropriate HTTP response
 */
export type ErrorCode =
  | "TASK_NOT_FOUND" // 404: Task does not exist
  | "CANDIDATE_NOT_FOUND" // 404: Task candidate does not exist
  | "UNAUTHORIZED" // 401: JWT unauthenticated
  | "TOKEN_EXPIRED" // 401: JWT expiration (Cognito)
  | "EXTERNAL_API_FAILED" // 502: Slack API error
  | "BEDROCK_TIMEOUT" // 504: Bedrock response timeout (5 seconds)
  | "BEDROCK_COST_EXCEEDED" // 429: Bedrock cost limit guard
  | "DYNAMO_WRITE_FAILED" // 500: DynamoDB write error
  | "INVALID_INPUT" // 400: Input validation error (Zod)
  | "PERSONA_NOT_FOUND" // 404: Persona does not exist
  | "CONNECTION_NOT_FOUND"; // 404: Service connection does not exist

/**
 * Serialized error response structure
 */
export interface SerializedError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  stack?: string | undefined;
}

/**
 * Base error class (Q6 answer)
 * All service-specific errors inherit from this class.
 * Designed to prevent internal stack trace leakage in HTTP responses (NFR-03).
 */
export class AppError extends Error {
  /** Application-specific error code */
  readonly code: ErrorCode;
  /** HTTP status code */
  readonly statusCode: number;
  /** Additional error details */
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message?: string,
    statusCode?: number,
    details?: unknown,
  ) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode ?? 500;
    this.details = details;
    // Correctly attach stack trace to Error (V8 environments)
    const errorConstructor = Error as typeof Error & {
      captureStackTrace?: (target: Error, constructor: unknown) => void;
    };
    if (errorConstructor.captureStackTrace) {
      errorConstructor.captureStackTrace(this, AppError);
    }
  }

  /**
   * Serialize error for HTTP response
   * Development: includes detailed message, details, and stack trace
   * Production: returns only generic message (security, NFR-S5)
   *
   * Server-side logging (CloudWatch) is independent and always records details
   */
  serialize(): SerializedError {
    if (process.env["NODE_ENV"] === "production") {
      return {
        code: this.code,
        message: "An unexpected error occurred.",
      };
    }

    const result: SerializedError = {
      code: this.code,
      message: this.message,
    };
    if (this.details !== undefined) {
      result.details = this.details;
    }
    if (this.stack !== undefined) {
      result.stack = this.stack;
    }
    return result;
  }
}
