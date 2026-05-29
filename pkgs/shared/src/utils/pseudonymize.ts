// biome-ignore lint/style/useNodejsImportProtocol: legacy module name kept for consistency across the codebase
import { createHmac } from "crypto";
import { AppError } from "../errors/AppError";

/**
 * 任意の識別子を HMAC-SHA256 で仮名化する (NFR-07 プライバシー保護)
 *
 * 【現在は未使用】requester / assignee は users.info で解決した表示名を
 * 生のまま保存する方針に変更したため、タスク抽出フローではこの関数を
 * 通していない（誰からのタスクかを画面で実名表示するための割り切り。
 * ハッカソンデモ要件を優先）。
 * 将来 PII を再びハッシュ化して保存したくなった場合に再利用できるよう、
 * 関数とソルト管理（PSEUDONYMIZE_SALT）はそのまま残してある。
 *
 * 設計方針（再利用時）:
 * - 元の値を DynamoDB に保存する前に仮名化する
 * - ハッシュは不可逆。元の値は DynamoDB に保存されない。
 * - ソルトは環境変数 PSEUDONYMIZE_SALT から取得する
 *   (未設定または 16 文字未満の場合はエラーをスロー)
 *
 * HMAC-SHA256 を使用する理由:
 * - SHA256(salt + name) は salt="abc"/name="def" と salt="abcd"/name="ef" が
 *   同一ハッシュになるソルト境界消失の脆弱性がある
 * - HMAC は salt をキーとして扱うためこの問題が発生しない
 * - PSEUDONYMIZE_SALT は AWS Systems Manager Parameter Store
 *   または Secrets Manager で管理する (aws-constraints.md, BR-06)
 *
 * @param name 仮名化する元の値
 * @returns HMAC-SHA256 ハッシュ値 (hex, 64 文字)
 * @throws AppError('INVALID_INPUT') ソルトが未設定または短すぎる場合
 */
export function pseudonymize(name: string): string {
  // biome-ignore lint/complexity/useLiteralKeys: env var name contains underscores, bracket notation is clearer
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
