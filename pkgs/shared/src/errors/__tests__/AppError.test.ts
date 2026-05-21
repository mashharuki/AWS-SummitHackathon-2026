import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import {
  AppError,
  BedrockCostExceededError,
  BedrockTimeoutError,
  DynamoWriteFailedError,
  TokenExpiredError,
  isAppError,
} from "../index";

describe("AppError", () => {
  describe("constructor", () => {
    it("should create error with code and default message", () => {
      const err = new AppError("TASK_NOT_FOUND");
      expect(err.code).toBe("TASK_NOT_FOUND");
      expect(err.message).toBe("TASK_NOT_FOUND");
      expect(err.statusCode).toBe(500);
      expect(err.name).toBe("AppError");
    });

    it("should create error with custom message and statusCode", () => {
      const err = new AppError("TASK_NOT_FOUND", "Task was not found", 404);
      expect(err.code).toBe("TASK_NOT_FOUND");
      expect(err.message).toBe("Task was not found");
      expect(err.statusCode).toBe(404);
    });

    it("should create error with details", () => {
      const details = { taskId: "123" };
      const err = new AppError("INVALID_INPUT", "Invalid", 400, details);
      expect(err.details).toEqual(details);
    });

    it("should be an instance of Error", () => {
      const err = new AppError("UNAUTHORIZED");
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
    });

    it("should have a stack trace", () => {
      const err = new AppError("UNAUTHORIZED");
      expect(err.stack).toBeDefined();
    });
  });

  describe("serialize()", () => {
    beforeEach(() => {
      // Default: development mode
      delete process.env["NODE_ENV"];
    });

    afterEach(() => {
      delete process.env["NODE_ENV"];
    });

    it("should return detailed info in development mode", () => {
      process.env["NODE_ENV"] = "development";
      const err = new AppError("TASK_NOT_FOUND", "Task missing", 404, {
        id: "123",
      });
      const serialized = err.serialize();
      expect(serialized.code).toBe("TASK_NOT_FOUND");
      expect(serialized.message).toBe("Task missing");
      expect(serialized.details).toEqual({ id: "123" });
      expect(serialized.stack).toBeDefined();
    });

    it("should return generic message in production mode", () => {
      process.env["NODE_ENV"] = "production";
      const err = new AppError("TASK_NOT_FOUND", "Task missing", 404, {
        id: "123",
      });
      const serialized = err.serialize();
      expect(serialized.code).toBe("TASK_NOT_FOUND");
      expect(serialized.message).toBe("An unexpected error occurred.");
      expect(serialized.details).toBeUndefined();
      expect(serialized.stack).toBeUndefined();
    });

    it("should not include details field when details is undefined", () => {
      const err = new AppError("INVALID_INPUT", "Bad input", 400);
      const serialized = err.serialize();
      expect("details" in serialized).toBe(false);
    });
  });
});

describe("BedrockTimeoutError", () => {
  it("should have correct code and statusCode", () => {
    const err = new BedrockTimeoutError();
    expect(err.code).toBe("BEDROCK_TIMEOUT");
    expect(err.statusCode).toBe(504);
    expect(err.name).toBe("BedrockTimeoutError");
    expect(err).toBeInstanceOf(AppError);
  });

  it("should accept custom message", () => {
    const err = new BedrockTimeoutError("Custom timeout message");
    expect(err.message).toBe("Custom timeout message");
  });
});

describe("BedrockCostExceededError", () => {
  it("should have correct code and statusCode", () => {
    const err = new BedrockCostExceededError();
    expect(err.code).toBe("BEDROCK_COST_EXCEEDED");
    expect(err.statusCode).toBe(429);
    expect(err.name).toBe("BedrockCostExceededError");
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("TokenExpiredError", () => {
  it("should have correct code and statusCode", () => {
    const err = new TokenExpiredError();
    expect(err.code).toBe("TOKEN_EXPIRED");
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe("TokenExpiredError");
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("DynamoWriteFailedError", () => {
  it("should have correct code and statusCode", () => {
    const err = new DynamoWriteFailedError();
    expect(err.code).toBe("DYNAMO_WRITE_FAILED");
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe("DynamoWriteFailedError");
    expect(err).toBeInstanceOf(AppError);
  });

  it("should accept details", () => {
    const details = { operation: "TransactWriteItems" };
    const err = new DynamoWriteFailedError("Write failed", details);
    expect(err.details).toEqual(details);
  });
});

describe("isAppError", () => {
  it("should return true for AppError instances", () => {
    expect(isAppError(new AppError("UNAUTHORIZED"))).toBe(true);
    expect(isAppError(new BedrockTimeoutError())).toBe(true);
    expect(isAppError(new TokenExpiredError())).toBe(true);
  });

  it("should return false for non-AppError values", () => {
    expect(isAppError(new Error("plain error"))).toBe(false);
    expect(isAppError("string")).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
    expect(isAppError(42)).toBe(false);
    expect(isAppError({})).toBe(false);
  });
});
