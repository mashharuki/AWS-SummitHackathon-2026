/**
 * Tests for application error classes
 */

import { describe, it, expect } from "vitest";
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../../errors.js";

describe("AppError", () => {
  it("creates error with statusCode, code, and message", () => {
    const err = new AppError(500, "INTERNAL", "something went wrong");
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("INTERNAL");
    expect(err.message).toBe("something went wrong");
    expect(err.name).toBe("AppError");
    expect(err instanceof Error).toBe(true);
  });
});

describe("UnauthorizedError", () => {
  it("defaults to 401 UNAUTHORIZED", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.name).toBe("UnauthorizedError");
  });

  it("accepts custom message", () => {
    const err = new UnauthorizedError("custom msg");
    expect(err.message).toBe("custom msg");
  });
});

describe("ForbiddenError", () => {
  it("defaults to 403 FORBIDDEN", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });
});

describe("NotFoundError", () => {
  it("defaults to 404 NOT_FOUND", () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("accepts custom message", () => {
    const err = new NotFoundError("Task not found");
    expect(err.message).toBe("Task not found");
  });
});

describe("ConflictError", () => {
  it("defaults to 409 CONFLICT", () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });
});

describe("ValidationError", () => {
  it("defaults to 400 VALIDATION_ERROR", () => {
    const err = new ValidationError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
  });
});
