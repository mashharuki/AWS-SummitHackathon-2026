import { createHmac } from "crypto";
import { AppError } from "../errors/AppError";

/**
 * リクエスト者名を HMAC-SHA256 で仮名化する (NFR-07 プライバシー保護)
 *
 * 設計方針:
 * - Slack メッセージのリクエスト者 (user_id / display_name) を
 *   DynamoDB に保存する前に仮名化する
 * - ハッシュは不可逆。元の名前は DynamoDB に保存されない。
 * - ソルトは環境変数 PSEUDONYMIZE_SALT から取得する
 *   (未設定または 16 文字未満の場合はエラーをスロー)
 *
 * HMAC-SHA256 を使用する理由:
 * - SHA256(salt + name) は salt="abc"/name="def" と salt="abcd"/name="ef" が
 *   同一ハッシュになるソルト境界消失の脆弱性がある
 * - HMAC は salt をキーとして扱うためこの問題が発生しない
 *
 * ビジネスルール:
 * - TaskCandidate.requester および Task.requester は保存前に
 *   必ず pseudonymize() を通す (BR-05)
 * - Slack API の user_id や username を直接 DynamoDB に書き込んではならない
 * - PSEUDONYMIZE_SALT は AWS Systems Manager Parameter Store
 *   または Secrets Manager で管理する (aws-constraints.md, BR-06)
 *
 * @param name 元のリクエスト者名または Slack user_id
 * @returns HMAC-SHA256 ハッシュ値 (hex, 64 文字)
 * @throws AppError('INVALID_INPUT') ソルトが未設定または短すぎる場合
 */
export function pseudonymize(name: string): string {
  const salt = process.env["PSEUDONYMIZE_SALT"];
  if (!salt || salt.length < 16) {
    throw new AppError(
      "INVALID_INPUT",
      "PSEUDONYMIZE_SALT must be at least 16 characters",
      500,
    );
  }
  return createHmac("sha256", salt).update(name).digest("hex");
}
