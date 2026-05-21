import { ulid } from "ulidx";

/**
 * ULID (Universally Unique Lexicographically Sortable Identifier) を生成する
 * DynamoDB の SK として使用する時刻順ソート可能な一意 ID
 *
 * Q4 回答: ulidx npm パッケージを使用
 * 理由: ブラウザ/Node.js 両環境に対応、crypto.getRandomValues() ベース
 *
 * 使用箇所:
 * - TaskCandidate 作成時: SK = TASK_CAND#<ulid>
 * - Task 作成時: SK = TASK#<ulid>
 *
 * ビジネスルール:
 * - TaskCandidate 作成時は必ず generateUlid() で SK を生成する
 * - TaskCandidate を Task に変換する際は新しい ULID を生成する (BR-04)
 * - ULID は大文字の Crockford Base32 形式 (26 文字)
 *
 * @returns ULID 文字列 (26 文字)
 */
export function generateUlid(): string {
  return ulid();
}
