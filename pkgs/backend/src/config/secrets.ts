/**
 * Secrets Manager モジュールスコープキャッシュ
 *
 * NFR-S3 / NFR-P1: シークレットは Lambda コンテナライフサイクル (Cold Start) に一度
 * AWS Secrets Manager から取得する。以降の呼び出しはキャッシュされた値を再利用し、
 * レイテンシーと Secrets Manager API 呼び出しコストの両方を削減する。
 *
 * キャッシュは意図的にモジュールスコープ (リクエストスコープではない) にしており、
 * ウォーム呼び出しを越えて持続する。
 */

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({
  region: process.env["AWS_REGION"] ?? "ap-northeast-1",
});

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedSecret {
  value: string;
  fetchedAt: number;
}

let slackSigningSecretCache: CachedSecret | undefined;
let slackClientSecretCache: CachedSecret | undefined;

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
 * Slack 署名シークレットを取得する (Webhook HMAC 検証用)
 * 初回取得後にキャッシュする。
 */
export async function getSlackSigningSecret(
  secretArn: string,
): Promise<string> {
  const now = Date.now();
  if (
    slackSigningSecretCache &&
    now - slackSigningSecretCache.fetchedAt < CACHE_TTL_MS
  ) {
    return slackSigningSecretCache.value;
  }
  const value = await fetchSecret(secretArn);
  slackSigningSecretCache = { value, fetchedAt: now };
  return value;
}

/**
 * Slack クライアントシークレットを取得する (OAuth トークン交換用)
 * TTL (5分) 経過後に再フェッチする。
 */
export async function getSlackClientSecret(secretArn: string): Promise<string> {
  const now = Date.now();
  if (
    slackClientSecretCache &&
    now - slackClientSecretCache.fetchedAt < CACHE_TTL_MS
  ) {
    return slackClientSecretCache.value;
  }
  const value = await fetchSecret(secretArn);
  slackClientSecretCache = { value, fetchedAt: now };
  return value;
}

/** キャッシュをリセットする — テスト専用 */
export function _resetSecretsCache(): void {
  slackSigningSecretCache = undefined;
  slackClientSecretCache = undefined;
}
