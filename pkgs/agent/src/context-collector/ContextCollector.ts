import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { logError } from "../utils/logger.js";

/**
 * ContextCollector — エージェントのコンテキスト取得 (DP-06)
 *
 * 責務:
 * - Secrets Manager から per-user の Slack Bot Token を取得 (ウォームキャッシュ最適化)
 * - U-03a (task-extractor) と U-03b (sabori-proposer) の両方で共有
 *
 * Bot Token は OAuth コールバックで per-user に保存される:
 *   シークレット名 = `${SLACK_BOT_TOKEN_SECRET_PREFIX}${cognitoSub}`
 *   (例: saborou/slack-bot-token/<cognitoSub>)
 *
 * DP-06: モジュールスコープの userId 別キャッシュで Lambda ウォーム呼び出し時の
 * Secrets Manager 繰り返し呼び出しを防いでレイテンシーと API コストを削減する。
 *
 * 注意: エラー時にキャッシュを無効化しない — 設定ミスのシークレットでサンダーハードが
 * 発生しないよう意図的。Lambda コールドスタート (または関数更新)時に
 * キャッシュはリセットされる。
 */

// モジュールスコープシングルトン — コールドスタート時のみリセット
const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? "ap-northeast-1",
});

// userId (cognitoSub) → Bot Token のキャッシュ
const tokenCache = new Map<string, string>();

const DEFAULT_SECRET_PREFIX = "saborou/slack-bot-token/";

/**
 * per-user の Slack Bot Token を Secrets Manager から取得する。
 * Lambda ウォーム呼び出し時は userId 別キャッシュ値を返す (DP-06)。
 *
 * @param userId Cognito sub。Bot Token シークレットの per-user キー。
 * @throws userId が空、またはシークレットが空の場合
 */
export async function getSlackToken(userId: string): Promise<string> {
  if (!userId) {
    throw new Error("userId is required to resolve the Slack bot token");
  }

  const cached = tokenCache.get(userId);
  if (cached !== undefined) {
    return cached;
  }

  const prefix =
    process.env.SLACK_BOT_TOKEN_SECRET_PREFIX ?? DEFAULT_SECRET_PREFIX;
  const secretName = `${prefix}${userId}`;

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

  tokenCache.set(userId, response.SecretString);
  return response.SecretString;
}

/**
 * Reset cached tokens (test utility / forced refresh)
 * Not intended for production use.
 */
export function resetSlackTokenCache(): void {
  tokenCache.clear();
}

/**
 * ContextCollector class — stateless wrapper for dependency injection
 *
 * Provides a class-based API for test mocking while delegating
 * to the module-level cached functions above.
 */
export class ContextCollector {
  async getSlackToken(userId: string): Promise<string> {
    return getSlackToken(userId);
  }
}
