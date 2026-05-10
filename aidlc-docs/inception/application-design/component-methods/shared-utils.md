# shared-utils — コンポーネントメソッド定義

**パッケージ**: packages/shared  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § SH-01

---

## 日時ユーティリティ

```typescript
/**
 * ISO 8601 日時を日本語の自然な表現に変換
 * @example formatDeadline('2026-05-11T14:00:00Z') → '明日 14:00'
 */
function formatDeadline(isoDate: string): string

/**
 * 現在時刻から指定日時までの残り分数を返す
 * @returns 正の値: 未来、負の値: 過去（超過）
 */
function minutesUntil(isoDate: string): number

/**
 * 締切が過ぎているかどうか
 */
function isOverdue(isoDate: string): boolean
```

---

## トークン管理ユーティリティ（Bedrock コスト制御）

```typescript
/**
 * テキストのトークン概算数を計算（日本語: 1文字≒1.5トークン）
 */
function countTokens(text: string): number

/**
 * テキストが指定トークン数を超える場合、末尾を切り捨てて返す
 * Bedrock API 呼び出し前にコンテキストナラティブをガード
 * @param limit デフォルト: 8000 トークン
 */
function guardTokenLimit(prompt: string, limit?: number): string
```

---

## エラー型定義

```typescript
class AppError extends Error {
  code: ErrorCode
  statusCode: number  // HTTP ステータスコード
  constructor(code: ErrorCode, message?: string)
}

type ErrorCode =
  | 'TASK_NOT_FOUND'        // 404: タスクが存在しない
  | 'UNAUTHORIZED'           // 401: JWT 未認証
  | 'TOKEN_EXPIRED'          // 401: JWT 有効期限切れ
  | 'EXTERNAL_API_FAILED'   // 502: Slack/Gmail/Calendar API エラー
  | 'BEDROCK_TIMEOUT'       // 504: Bedrock レスポンスタイムアウト（5秒）
  | 'BEDROCK_COST_EXCEEDED' // 429: Bedrock コスト上限ガード
  | 'DYNAMO_WRITE_FAILED'   // 500: DynamoDB 書き込みエラー
```

---

## 共通型定義

> 詳細な DynamoDB テーブル型定義（Task, Proposal, HonneData 等）は [components.md](../components.md) § SH-01 を参照。

```typescript
// packages/shared/types/index.ts からエクスポートされる型
export type { Task, TaskCandidate, Proposal, HonneData, ServiceConnection, User, Persona }
export type { Verdict, ErrorCode }
export { AppError }
```

---

## 関連要件

- NFR-01: Bedrock タイムアウト制御（`guardTokenLimit` でプロンプト肥大化を防止）
- NFR-06: コスト制御（`countTokens` によるプリフライト確認）
- NFR-03: セキュリティ（`AppError` で内部スタックトレースを外部に漏らさない）
