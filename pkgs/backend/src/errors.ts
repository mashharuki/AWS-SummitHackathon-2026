/**
 * Application error classes for U-04 API
 *
 * Design: AppError carries statusCode + code for consistent JSON error responses.
 * The global error handler in middleware/error-handler.ts inspects instanceof AppError.
 */

import type { StatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  constructor(
    public readonly statusCode: StatusCode,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = "Unauthorized") {
    super(401, "UNAUTHORIZED", msg);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = "Forbidden") {
    super(403, "FORBIDDEN", msg);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(msg = "Not found") {
    super(404, "NOT_FOUND", msg);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(msg = "Conflict") {
    super(409, "CONFLICT", msg);
    this.name = "ConflictError";
  }
}

export class ValidationError extends AppError {
  constructor(msg = "Validation error") {
    super(400, "VALIDATION_ERROR", msg);
    this.name = "ValidationError";
  }
}
