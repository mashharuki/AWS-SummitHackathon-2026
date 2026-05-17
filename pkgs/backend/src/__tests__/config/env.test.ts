/**
 * Tests for config/env.ts environment variable accessor
 *
 * env.ts uses JavaScript getters that read process.env at call time,
 * so we do NOT need resetModules. We simply set/delete process.env
 * keys and then access env.* to trigger the getter.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { env } from "../../config/env.js";

// Store originals so we can restore after tests
const REQUIRED_VARS = [
  "COGNITO_USER_POOL_ID",
  "COGNITO_CLIENT_ID",
  "DYNAMODB_TABLE_USERS",
  "DYNAMODB_TABLE_CONNECTIONS",
  "DYNAMODB_TABLE_TASK_CANDIDATES",
  "DYNAMODB_TABLE_TASKS",
  "DYNAMODB_TABLE_PROPOSALS",
  "DYNAMODB_TABLE_HONNE_DATA",
  "DYNAMODB_TABLE_PERSONAS",
  "SLACK_SIGNING_SECRET_ARN",
  "SLACK_CLIENT_SECRET_ARN",
  "EVENT_BUS_NAME",
] as const;

type RequiredVar = (typeof REQUIRED_VARS)[number];

const savedEnv: Partial<Record<RequiredVar | "ENVIRONMENT", string>> = {};

beforeAll(() => {
  // Save current values
  for (const key of [...REQUIRED_VARS, "ENVIRONMENT" as const]) {
    savedEnv[key] = process.env[key];
  }
});

afterAll(() => {
  // Restore all values
  for (const key of [...REQUIRED_VARS, "ENVIRONMENT" as const]) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

describe("env — requireEnv (getter)", () => {
  it("returns value when COGNITO_USER_POOL_ID is set", () => {
    process.env.COGNITO_USER_POOL_ID = "ap-northeast-1_test123";
    expect(env.COGNITO_USER_POOL_ID).toBe("ap-northeast-1_test123");
  });

  it("throws when COGNITO_USER_POOL_ID is missing", () => {
    delete process.env.COGNITO_USER_POOL_ID;
    expect(() => env.COGNITO_USER_POOL_ID).toThrow(
      "Missing required environment variable: COGNITO_USER_POOL_ID",
    );
  });

  it("returns value when COGNITO_CLIENT_ID is set", () => {
    process.env.COGNITO_CLIENT_ID = "client-id-test";
    expect(env.COGNITO_CLIENT_ID).toBe("client-id-test");
  });

  it("throws when COGNITO_CLIENT_ID is missing", () => {
    delete process.env.COGNITO_CLIENT_ID;
    expect(() => env.COGNITO_CLIENT_ID).toThrow(
      "Missing required environment variable",
    );
  });

  it("returns value for DYNAMODB_TABLE_USERS when set", () => {
    process.env.DYNAMODB_TABLE_USERS = "users-table";
    expect(env.DYNAMODB_TABLE_USERS).toBe("users-table");
  });

  it("throws for DYNAMODB_TABLE_USERS when missing", () => {
    delete process.env.DYNAMODB_TABLE_USERS;
    expect(() => env.DYNAMODB_TABLE_USERS).toThrow(
      "Missing required environment variable",
    );
  });

  it("returns value for DYNAMODB_TABLE_CONNECTIONS when set", () => {
    process.env.DYNAMODB_TABLE_CONNECTIONS = "conn-table";
    expect(env.DYNAMODB_TABLE_CONNECTIONS).toBe("conn-table");
  });

  it("throws for DYNAMODB_TABLE_CONNECTIONS when missing", () => {
    delete process.env.DYNAMODB_TABLE_CONNECTIONS;
    expect(() => env.DYNAMODB_TABLE_CONNECTIONS).toThrow(
      "Missing required environment variable",
    );
  });

  it("returns value for DYNAMODB_TABLE_TASK_CANDIDATES when set", () => {
    process.env.DYNAMODB_TABLE_TASK_CANDIDATES = "cand-table";
    expect(env.DYNAMODB_TABLE_TASK_CANDIDATES).toBe("cand-table");
  });

  it("throws for DYNAMODB_TABLE_TASK_CANDIDATES when missing", () => {
    delete process.env.DYNAMODB_TABLE_TASK_CANDIDATES;
    expect(() => env.DYNAMODB_TABLE_TASK_CANDIDATES).toThrow(
      "Missing required environment variable",
    );
  });

  it("returns value for DYNAMODB_TABLE_TASKS when set", () => {
    process.env.DYNAMODB_TABLE_TASKS = "tasks-table";
    expect(env.DYNAMODB_TABLE_TASKS).toBe("tasks-table");
  });

  it("throws for DYNAMODB_TABLE_TASKS when missing", () => {
    delete process.env.DYNAMODB_TABLE_TASKS;
    expect(() => env.DYNAMODB_TABLE_TASKS).toThrow(
      "Missing required environment variable",
    );
  });

  it("returns value for DYNAMODB_TABLE_PROPOSALS when set", () => {
    process.env.DYNAMODB_TABLE_PROPOSALS = "proposals-table";
    expect(env.DYNAMODB_TABLE_PROPOSALS).toBe("proposals-table");
  });

  it("throws for DYNAMODB_TABLE_PROPOSALS when missing", () => {
    delete process.env.DYNAMODB_TABLE_PROPOSALS;
    expect(() => env.DYNAMODB_TABLE_PROPOSALS).toThrow(
      "Missing required environment variable",
    );
  });

  it("returns value for DYNAMODB_TABLE_HONNE_DATA when set", () => {
    process.env.DYNAMODB_TABLE_HONNE_DATA = "honne-table";
    expect(env.DYNAMODB_TABLE_HONNE_DATA).toBe("honne-table");
  });

  it("throws for DYNAMODB_TABLE_HONNE_DATA when missing", () => {
    delete process.env.DYNAMODB_TABLE_HONNE_DATA;
    expect(() => env.DYNAMODB_TABLE_HONNE_DATA).toThrow(
      "Missing required environment variable",
    );
  });

  it("returns value for DYNAMODB_TABLE_PERSONAS when set", () => {
    process.env.DYNAMODB_TABLE_PERSONAS = "personas-table";
    expect(env.DYNAMODB_TABLE_PERSONAS).toBe("personas-table");
  });

  it("throws for DYNAMODB_TABLE_PERSONAS when missing", () => {
    delete process.env.DYNAMODB_TABLE_PERSONAS;
    expect(() => env.DYNAMODB_TABLE_PERSONAS).toThrow(
      "Missing required environment variable",
    );
  });

  it("returns value for SLACK_SIGNING_SECRET_ARN when set", () => {
    process.env.SLACK_SIGNING_SECRET_ARN = "arn:signing";
    expect(env.SLACK_SIGNING_SECRET_ARN).toBe("arn:signing");
  });

  it("throws for SLACK_SIGNING_SECRET_ARN when missing", () => {
    delete process.env.SLACK_SIGNING_SECRET_ARN;
    expect(() => env.SLACK_SIGNING_SECRET_ARN).toThrow(
      "Missing required environment variable",
    );
  });

  it("returns value for SLACK_CLIENT_SECRET_ARN when set", () => {
    process.env.SLACK_CLIENT_SECRET_ARN = "arn:client";
    expect(env.SLACK_CLIENT_SECRET_ARN).toBe("arn:client");
  });

  it("throws for SLACK_CLIENT_SECRET_ARN when missing", () => {
    delete process.env.SLACK_CLIENT_SECRET_ARN;
    expect(() => env.SLACK_CLIENT_SECRET_ARN).toThrow(
      "Missing required environment variable",
    );
  });

  it("returns value for EVENT_BUS_NAME when set", () => {
    process.env.EVENT_BUS_NAME = "saborou-bus";
    expect(env.EVENT_BUS_NAME).toBe("saborou-bus");
  });

  it("throws for EVENT_BUS_NAME when missing", () => {
    delete process.env.EVENT_BUS_NAME;
    expect(() => env.EVENT_BUS_NAME).toThrow(
      "Missing required environment variable",
    );
  });
});

describe("env.ENVIRONMENT — optionalEnv with default", () => {
  it("returns 'dev' when ENVIRONMENT is not set", () => {
    delete process.env.ENVIRONMENT;
    expect(env.ENVIRONMENT).toBe("dev");
  });

  it("returns value when ENVIRONMENT is set", () => {
    process.env.ENVIRONMENT = "prod";
    expect(env.ENVIRONMENT).toBe("prod");
  });
});
