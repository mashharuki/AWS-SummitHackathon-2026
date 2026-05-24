/**
 * OAuth state utility — CSRF protection for OAuth 2.0 flows
 *
 * Provides HMAC-SHA256 signed state parameter generation and verification.
 * Shared by Slack OAuth and Google OAuth flows.
 *
 * FR-03 (Slack) / BR-G-01 (Google): state parameter CSRF protection
 *
 * セキュリティ: state には issuedAt タイムスタンプを含め、有効期限（10分）を検証する。
 * これにより、古い state の再利用（リプレイ攻撃）を防止する。
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** OAuth state の最大有効時間: 10分 */
export const STATE_MAX_AGE_MS = 10 * 60 * 1000;

/** state ペイロードの型定義 */
type OAuthStatePayload = {
  userId: string;
  nonce: string;
  issuedAt: number;
};

/**
 * Sign a payload string with HMAC-SHA256.
 * Returns hex digest.
 */
export function signState(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Encode a signed state object to base64url string.
 * State contains: { userId, nonce, issuedAt } payload + HMAC mac.
 */
export function encodeState(userId: string, secret: string): string {
  const nonce = crypto.randomUUID();
  const payload = JSON.stringify({
    userId,
    nonce,
    issuedAt: Date.now(),
  } satisfies OAuthStatePayload);
  const mac = signState(payload, secret);
  return Buffer.from(JSON.stringify({ payload, mac })).toString("base64url");
}

/**
 * Verify and decode a base64url state string.
 * Returns { userId } on success, null on invalid/tampered/expired state.
 */
export function verifyState(
  stateParam: string,
  secret: string,
): { userId: string } | null {
  try {
    const decoded = Buffer.from(stateParam, "base64url").toString("utf8");
    const { payload, mac } = JSON.parse(decoded) as {
      payload: string;
      mac: string;
    };
    const expected = signState(payload, secret);
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(mac, "hex");
    if (
      expectedBuf.length !== actualBuf.length ||
      !timingSafeEqual(expectedBuf, actualBuf)
    ) {
      return null;
    }
    const parsed = JSON.parse(payload) as Partial<OAuthStatePayload>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.issuedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.issuedAt > STATE_MAX_AGE_MS) {
      return null;
    }
    return { userId: parsed.userId };
  } catch {
    return null;
  }
}
