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
 * Slack 署名シークレットを取得する (Webhook HMAC 検証用)
 * 初回取得後にキャッシュする。
 */
export async function getSlackSigningSecret(
  secretArn: string,
): Promise<string> {
  if (slackSigningSecretCache) return slackSigningSecretCache;
  slackSigningSecretCache = await fetchSecret(secretArn);
  return slackSigningSecretCache;
}

/**
 * Slack クライアントシークレットを取得する (OAuth トークン交換用)
 * 初回取得後にキャッシュする。
 */
export async function getSlackClientSecret(secretArn: string): Promise<string> {
  if (slackClientSecretCache) return slackClientSecretCache;
  slackClientSecretCache = await fetchSecret(secretArn);
  return slackClientSecretCache;
}

/** キャッシュをリセットする — テスト専用 */
export function _resetSecretsCache(): void {
  slackSigningSecretCache = undefined;
  slackClientSecretCache = undefined;
}
