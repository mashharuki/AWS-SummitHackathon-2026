/**
 * Environment variable accessor with validation
 *
 * All environment variables are accessed through this module to ensure
 * missing variables fail fast with a clear error message rather than
 * producing undefined at runtime.
 *
 * NFR-P1: Variables are read once at module load (Lambda warm path).
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name];
}

export const env = {
  get ENVIRONMENT(): string {
    return optionalEnv("ENVIRONMENT") ?? "dev";
  },
  get COGNITO_USER_POOL_ID(): string {
    return requireEnv("COGNITO_USER_POOL_ID");
  },
  get COGNITO_CLIENT_ID(): string {
    return requireEnv("COGNITO_CLIENT_ID");
  },
  get DYNAMODB_TABLE_USERS(): string {
    return requireEnv("DYNAMODB_TABLE_USERS");
  },
  get DYNAMODB_TABLE_CONNECTIONS(): string {
    return requireEnv("DYNAMODB_TABLE_CONNECTIONS");
  },
  get DYNAMODB_TABLE_TASK_CANDIDATES(): string {
    return requireEnv("DYNAMODB_TABLE_TASK_CANDIDATES");
  },
  get DYNAMODB_TABLE_TASKS(): string {
    return requireEnv("DYNAMODB_TABLE_TASKS");
  },
  get DYNAMODB_TABLE_PROPOSALS(): string {
    return requireEnv("DYNAMODB_TABLE_PROPOSALS");
  },
  get DYNAMODB_TABLE_HONNE_DATA(): string {
    return requireEnv("DYNAMODB_TABLE_HONNE_DATA");
  },
  get DYNAMODB_TABLE_PERSONAS(): string {
    return requireEnv("DYNAMODB_TABLE_PERSONAS");
  },
  get SLACK_SIGNING_SECRET_ARN(): string {
    return requireEnv("SLACK_SIGNING_SECRET_ARN");
  },
  get SLACK_CLIENT_SECRET_ARN(): string {
    return requireEnv("SLACK_CLIENT_SECRET_ARN");
  },
  get EVENT_BUS_NAME(): string {
    return requireEnv("EVENT_BUS_NAME");
  },
} as const;
