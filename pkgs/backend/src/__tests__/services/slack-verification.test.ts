/**
 * Slack HMAC 署名検証のテスト
 *
 * NFR-S2: verifySlackSignature は以下を拒否すること:
 * - 期限切れタイムスタンプ (5 分超過)
 * - 無効な署名
 * - 改ざんされたボディ
 * また有効な署名は受入れること。
 */

import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifySlackSignature } from "../../services/slack-verification.js";

const SIGNING_SECRET = "test-signing-secret-32chars-x";

function makeSignature(
  body: string,
  timestamp: string,
  secret = SIGNING_SECRET,
): string {
  return `v0=${createHmac("sha256", secret)
    .update(`v0:${timestamp}:${body}`)
    .digest("hex")}`;
}

function nowTs(): string {
  return String(Math.floor(Date.now() / 1000));
}

describe("verifySlackSignature", () => {
  it("returns true for a valid signature", async () => {
    const body = '{"type":"event_callback"}';
    const ts = nowTs();
    const sig = makeSignature(body, ts);
    await expect(
      verifySlackSignature(body, ts, sig, SIGNING_SECRET),
    ).resolves.toBe(true);
  });

  it("returns false for an invalid signature (wrong secret)", async () => {
    const body = '{"type":"event_callback"}';
    const ts = nowTs();
    const sig = makeSignature(body, ts, "wrong-secret");
    await expect(
      verifySlackSignature(body, ts, sig, SIGNING_SECRET),
    ).resolves.toBe(false);
  });

  it("returns false for tampered body", async () => {
    const body = '{"type":"event_callback"}';
    const ts = nowTs();
    const sig = makeSignature(body, ts);
    const tamperedBody = '{"type":"malicious"}';
    await expect(
      verifySlackSignature(tamperedBody, ts, sig, SIGNING_SECRET),
    ).resolves.toBe(false);
  });

  it("returns false for expired timestamp (>5 min old)", async () => {
    const body = '{"type":"event_callback"}';
    const oldTs = String(Math.floor(Date.now() / 1000) - 400);
    const sig = makeSignature(body, oldTs);
    await expect(
      verifySlackSignature(body, oldTs, sig, SIGNING_SECRET),
    ).resolves.toBe(false);
  });

  it("returns false for future timestamp (clock skew >5 min)", async () => {
    const body = '{"type":"event_callback"}';
    const futureTs = String(Math.floor(Date.now() / 1000) + 400);
    const sig = makeSignature(body, futureTs);
    await expect(
      verifySlackSignature(body, futureTs, sig, SIGNING_SECRET),
    ).resolves.toBe(false);
  });

  it("returns false for non-numeric timestamp", async () => {
    const body = '{"type":"event_callback"}';
    const sig = makeSignature(body, "invalid");
    await expect(
      verifySlackSignature(body, "invalid", sig, SIGNING_SECRET),
    ).resolves.toBe(false);
  });

  it("returns false for different length signatures (length mismatch early exit)", async () => {
    const body = '{"type":"event_callback"}';
    const ts = nowTs();
    await expect(
      verifySlackSignature(body, ts, "short", SIGNING_SECRET),
    ).resolves.toBe(false);
  });

  it("accepts a signature within the 5-minute window", async () => {
    const body = "challenge-body";
    const ts = String(Math.floor(Date.now() / 1000) - 299); // 4m59s ago
    const sig = makeSignature(body, ts);
    await expect(
      verifySlackSignature(body, ts, sig, SIGNING_SECRET),
    ).resolves.toBe(true);
  });
});
