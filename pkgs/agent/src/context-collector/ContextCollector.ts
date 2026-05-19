import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { logError } from "../utils/logger.js";

/**
 * ContextCollector — エージェントのコンテキスト取得 (DP-06)
 *
 * 責務:
 * - Secrets Manager から Slack OAuth トークンを取得 (ウォームキャッシュ最適化)
 * - U-03a (task-extractor) と U-03b (sabori-proposer) の両方で共有
 *
 * DP-06: モジュールスコープキャッシュで Lambda ウォーム呼び出し時の
 * Secrets Manager 繰り返し呼び出しを防いでレイテンシーと API コストを削減する。
 *
 * 注意: エラー時にキャッシュを無効化しない — 設定ミスのシークレットでサンダーハードが
 * 発生しないよう意図的。Lambda コールドスタート (または関数更新)時に
 * キャッシュはリセットされる。
 */

// モジュールスコープシングルトン — コールドスタート時のみリセット
const secretsClient = new SecretsManagerClient({
  region: process.env["AWS_REGION"] ?? "ap-northeast-1",
});

let cachedSlackToken: string | undefined;

/**
 * Secrets Manager から Slack OAuth トークンを取得する。
 * Lambda ウォーム呼び出し時はキャッシュ値を返す (DP-06)。
 *
 * @throws SLACK_TOKEN_SECRET_NAME が未設定またはシークレットが空の場合
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
