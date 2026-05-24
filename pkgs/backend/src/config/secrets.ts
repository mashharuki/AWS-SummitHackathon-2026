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
  CreateSecretCommand,
  GetSecretValueCommand,
  SecretsManagerClient,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  type GoogleTokenSecret,
  GoogleTokenSecretSchema,
} from "../types/google.js";

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? "ap-northeast-1",
});

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedSecret {
  value: string;
  fetchedAt: number;
}

let slackSigningSecretCache: CachedSecret | undefined;
let slackClientSecretCache: CachedSecret | undefined;
let googleClientSecretCache: CachedSecret | undefined;

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

/**
 * Google OAuth クライアントシークレットを取得する (JSON形式)
 * TTL (5分) 経過後に再フェッチする。
 */
export async function getGoogleClientSecret(
  secretArn: string,
): Promise<string> {
  const now = Date.now();
  if (
    googleClientSecretCache &&
    now - googleClientSecretCache.fetchedAt < CACHE_TTL_MS
  ) {
    return googleClientSecretCache.value;
  }
  const value = await fetchSecret(secretArn);
  googleClientSecretCache = { value, fetchedAt: now };
  return value;
}

// In-memory cache for per-user Google tokens (access token only; refresh token in SM)
const googleTokenCache = new Map<
  string,
  { accessToken: string; expiresAt: number; scope: string }
>();

/**
 * per-user の Google トークンを取得する (JSON 形式)
 *
 * Secrets Manager に保存されたトークン JSON を取得してパースする。
 * access_token は Lambda in-memory キャッシュに保存してウォーム時に再利用する。
 */
export async function getGoogleToken(
  userId: string,
  secretName: string,
): Promise<GoogleTokenSecret> {
  const raw = await fetchSecret(secretName);
  // Zod でバリデーションしてから使用する（malformed な secret がキャッシュに入るのを防ぐ）
  const parsed = GoogleTokenSecretSchema.parse(JSON.parse(raw));
  // Update in-memory cache
  googleTokenCache.set(userId, {
    accessToken: parsed.accessToken,
    expiresAt: new Date(parsed.expiresAt).getTime(),
    scope: parsed.scope,
  });
  return parsed;
}

/**
 * per-user の Google トークンを保存または更新する (JSON 形式)
 *
 * Slack Bot Token は平文だが、Google トークンは複数値が必要なので JSON で保存する。
 */
export async function saveGoogleToken(
  userId: string,
  secretName: string,
  tokenData: GoogleTokenSecret,
): Promise<string> {
  const smClient = new SecretsManagerClient({
    region: process.env.AWS_REGION ?? "ap-northeast-1",
  });
  const secretString = JSON.stringify(tokenData);
  try {
    const createResult = await smClient.send(
      new CreateSecretCommand({
        Name: secretName,
        SecretString: secretString,
        Description: `Google OAuth token for Saborou user ${userId}`,
      }),
    );
    // Update in-memory cache
    googleTokenCache.set(userId, {
      accessToken: tokenData.accessToken,
      expiresAt: new Date(tokenData.expiresAt).getTime(),
      scope: tokenData.scope,
    });
    return createResult.ARN ?? secretName;
  } catch (err) {
    if ((err as { name?: string }).name === "ResourceExistsException") {
      const updateResult = await smClient.send(
        new UpdateSecretCommand({
          SecretId: secretName,
          SecretString: secretString,
        }),
      );
      // Update in-memory cache
      googleTokenCache.set(userId, {
        accessToken: tokenData.accessToken,
        expiresAt: new Date(tokenData.expiresAt).getTime(),
        scope: tokenData.scope,
      });
      return updateResult.ARN ?? secretName;
    }
    throw err;
  }
}

/**
 * in-memory の Google アクセストークンキャッシュから取得する。
 * キャッシュミスまたは有効期限切れの場合は null を返す（呼び出し元でリフレッシュする）。
 */
export function getCachedGoogleAccessToken(
  userId: string,
): { accessToken: string; expiresAt: number; scope: string } | null {
  const cached = googleTokenCache.get(userId);
  if (!cached) return null;
  return cached;
}

/** キャッシュをリセットする — テスト専用 */
export function _resetSecretsCache(): void {
  slackSigningSecretCache = undefined;
  slackClientSecretCache = undefined;
  googleClientSecretCache = undefined;
  googleTokenCache.clear();
}
