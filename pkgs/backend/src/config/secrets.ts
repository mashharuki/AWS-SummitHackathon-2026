/**
 * Secrets Manager module-scope cache
 *
 * NFR-S3 / NFR-P1: Secrets are fetched from AWS Secrets Manager once per
 * Lambda container lifecycle (cold start). Subsequent invocations reuse the
 * cached value, reducing both latency and Secrets Manager API call costs.
 *
 * The cache is intentionally module-scoped (not request-scoped) to survive
 * across warm invocations.
 */

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "ap-northeast-1" });

let slackSigningSecretCache: string | undefined;
let slackClientSecretCache: string | undefined;

async function fetchSecret(secretArn: string): Promise<string> {
  const result = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );
  if (!result.SecretString) {
    throw new Error(`Secret ${secretArn} has no SecretString`);
  }
  return result.SecretString;
}

/**
 * Get Slack signing secret (for Webhook HMAC verification)
 * Cached after first fetch.
 */
export async function getSlackSigningSecret(
  secretArn: string,
): Promise<string> {
  if (slackSigningSecretCache) return slackSigningSecretCache;
  slackSigningSecretCache = await fetchSecret(secretArn);
  return slackSigningSecretCache;
}

/**
 * Get Slack client secret (for OAuth token exchange)
 * Cached after first fetch.
 */
export async function getSlackClientSecret(secretArn: string): Promise<string> {
  if (slackClientSecretCache) return slackClientSecretCache;
  slackClientSecretCache = await fetchSecret(secretArn);
  return slackClientSecretCache;
}

/** Reset caches — for use in tests only */
export function _resetSecretsCache(): void {
  slackSigningSecretCache = undefined;
  slackClientSecretCache = undefined;
}
