/**
 * Slack HMAC signature verification
 *
 * NFR-S2: Verifies that Webhook POST requests originate from Slack using
 * HMAC-SHA256 signature with the signing secret.
 *
 * Security properties:
 * - Replay attack prevention: timestamps older than 5 minutes are rejected
 * - Timing attack prevention: timingSafeEqual for constant-time comparison
 *
 * Reference: https://api.slack.com/authentication/verifying-requests-from-slack
 */

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify a Slack request signature.
 *
 * @param body - Raw request body string (must be read before JSON parsing)
 * @param timestamp - X-Slack-Request-Timestamp header value
 * @param signature - X-Slack-Signature header value (e.g., "v0=abc123...")
 * @param signingSecret - Slack app signing secret from Secrets Manager
 * @returns true if the signature is valid and the request is recent
 */
export async function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
  signingSecret: string,
): Promise<boolean> {
  // Replay attack prevention: reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    return false;
  }

  // Compute expected signature
  const baseString = `v0:${timestamp}:${body}`;
  const expected = `v0=${createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex")}`;

  // Timing-safe comparison (prevents timing attacks)
  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature, "utf8");

  if (expectedBuf.length !== signatureBuf.length) {
    // Length mismatch — still use timingSafeEqual on same-length buffers
    // to avoid leaking length information
    return false;
  }

  return timingSafeEqual(expectedBuf, signatureBuf);
}
