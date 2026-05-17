import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { logError } from "../utils/logger.js";

/**
 * ContextCollector — Slack context retrieval for agent enrichment (DP-06)
 *
 * Responsibilities:
 * - Fetch Slack OAuth token from Secrets Manager (with warm-cache optimization)
 * - Shared between U-03a (task-extractor) and U-03b (sabori-proposer)
 *
 * DP-06: Module-scope cache prevents repeated Secrets Manager calls
 * on Lambda warm invocations, reducing latency and API costs.
 *
 * Note: The cache is intentionally NOT invalidated on error to avoid
 * thundering-herd on a misconfigured secret. A Lambda cold start
 * (or function update) will reset the cache.
 */

// Module-scope singleton — reset only on cold start
const secretsClient = new SecretsManagerClient({
  region: process.env["AWS_REGION"] ?? "ap-northeast-1",
});

let cachedSlackToken: string | undefined;

/**
 * Fetch Slack OAuth token from Secrets Manager.
 * Returns cached value on warm Lambda invocations (DP-06).
 *
 * @throws Error if SLACK_TOKEN_SECRET_NAME is not set or secret is empty
 */
export async function getSlackToken(): Promise<string> {
  if (cachedSlackToken !== undefined) {
    return cachedSlackToken;
  }

  const secretName = process.env["SLACK_TOKEN_SECRET_NAME"];
  if (!secretName) {
    throw new Error("SLACK_TOKEN_SECRET_NAME environment variable is required");
  }

  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName }),
  );

  if (!response.SecretString) {
    logError({
      action: "secrets_manager_empty",
      secretName,
    });
    throw new Error(`Secret ${secretName} has no SecretString value`);
  }

  cachedSlackToken = response.SecretString;
  return cachedSlackToken;
}

/**
 * Reset cached token (test utility / forced refresh)
 * Not intended for production use.
 */
export function resetSlackTokenCache(): void {
  cachedSlackToken = undefined;
}

/**
 * ContextCollector class — stateless wrapper for dependency injection
 *
 * Provides a class-based API for test mocking while delegating
 * to the module-level cached functions above.
 */
export class ContextCollector {
  async getSlackToken(): Promise<string> {
    return getSlackToken();
  }
}
