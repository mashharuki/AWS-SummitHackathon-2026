/**
 * OAuth state utility — CSRF protection for OAuth 2.0 flows
 *
 * Provides HMAC-SHA256 signed state parameter generation and verification.
 * Shared by Slack OAuth and Google OAuth flows.
 *
 * FR-03 (Slack) / BR-G-01 (Google): state parameter CSRF protection
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sign a payload string with HMAC-SHA256.
 * Returns hex digest.
 */
export function signState(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Encode a signed state object to base64url string.
 * State contains: { userId } payload + HMAC mac.
 */
export function encodeState(userId: string, secret: string): string {
  const nonce = crypto.randomUUID();
  const payload = JSON.stringify({ userId, nonce });
  const mac = signState(payload, secret);
  return Buffer.from(JSON.stringify({ payload, mac })).toString("base64url");
}

/**
 * Verify and decode a base64url state string.
 * Returns { userId } on success, null on invalid/tampered state.
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
    return JSON.parse(payload) as { userId: string };
  } catch {
    return null;
  }
}
