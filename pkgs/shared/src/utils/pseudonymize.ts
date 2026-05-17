import { createHash } from "crypto";
import { AppError } from "../errors/AppError";

/**
 * リクエスト者名を SHA-256 ハッシュで仮名化する (NFR-07 プライバシー保護)
 *
 * Q5 回答: SHA-256 ハッシュ化、Node.js 標準 crypto モジュール
 *
 * 設計方針:
 * - Slack メッセージのリクエスト者 (user_id / display_name) を
 *   DynamoDB に保存する前に仮名化する
 * - ハッシュは不可逆。元の名前は DynamoDB に保存されない。
 * - ソルトは環境変数 PSEUDONYMIZE_SALT から取得する
 *   (未設定の場合はエラーをスロー)
 *
 * ビジネスルール:
 * - TaskCandidate.requester および Task.requester は保存前に
 *   必ず pseudonymize() を通す (BR-05)
 * - Slack API の user_id や username を直接 DynamoDB に書き込んではならない
 * - PSEUDONYMIZE_SALT は AWS Systems Manager Parameter Store
 *   または Secrets Manager で管理する (aws-constraints.md, BR-06)
 *
 * @param name 元のリクエスト者名または Slack user_id
 * @returns SHA-256 ハッシュ値 (hex, 64 文字)
 * @throws AppError('INVALID_INPUT') ソルトが未設定の場合
 */
export function pseudonymize(name: string): string {
  const salt = process.env["PSEUDONYMIZE_SALT"];
  if (!salt) {
    throw new AppError(
      "INVALID_INPUT",
      "PSEUDONYMIZE_SALT environment variable is required",
      500,
    );
  }
  return createHash("sha256")
    .update(salt + name)
    .digest("hex");
}
