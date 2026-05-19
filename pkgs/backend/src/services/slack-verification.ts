/**
 * Slack HMAC 署名検証
 *
 * NFR-S2: HMAC-SHA256 と署名シークレットを用いて Webhook POST リクエストが
 * Slack から発信されたものであることを検証する。
 *
 * セキュリティ特性:
 * - リプレイ攻撃防止: 5 分以上前のタイムスタンプは拒否
 * - タイミング攻撃防止: 定数時間比較に timingSafeEqual を使用
 *
 * 参考: https://api.slack.com/authentication/verifying-requests-from-slack
 */

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Slack リクエスト署名を検証する。
 *
 * @param body - 生のリクエストボディ文字列 (JSON パース前に読み取る必要あり)
 * @param timestamp - X-Slack-Request-Timestamp ヘッダー値
 * @param signature - X-Slack-Signature ヘッダー値 (例: "v0=abc123...")
 * @param signingSecret - Secrets Manager から取得した Slack アプリ署名シークレット
 * @returns 署名が有効かつリクエストが最新の場合 true
 */
export async function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
  signingSecret: string,
): Promise<boolean> {
  // リプレイ攻撃防止: 5 分以上前のリクエストを拒否
  const now = Math.floor(Date.now() / 1000);
  const ts = Number.parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    return false;
  }

  // 期待される署名を計算
  const baseString = `v0:${timestamp}:${body}`;
  const expected = `v0=${createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex")}`;

  // 定数時間比較 (タイミング攻撃防止)
  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature, "utf8");

  if (expectedBuf.length !== signatureBuf.length) {
    // 長さ不一致 — 長さ情報のリークを避けるため
    // 同一長のバッファで timingSafeEqual を使用する
    return false;
  }

  return timingSafeEqual(expectedBuf, signatureBuf);
}
