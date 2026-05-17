# ビジネスルール定義 — packages/shared

**Unit**: U-01: shared  
**ステージ**: CONSTRUCTION / Functional Design  
**作成日**: 2026-05-17  
**バージョン**: 1.0.0  
**参照**:
- `domain-entities.md`（本ディレクトリ）
- `aidlc-docs/inception/requirements/requirements.md` NFR-01〜NFR-11
- `aidlc-docs/inception/application-design/dynamodb-access-patterns.md`
- Q1〜Q10 回答（2026-05-17 ユーザー確定）

---

## 1. エラークラス階層（Q6 回答）

`AppError` を基底クラスとし、各エラーサブクラスが継承する。

```typescript
// packages/shared/src/errors/AppError.ts

/**
 * 基底エラークラス（Q6 回答）
 * すべてのサービス固有エラーはこのクラスを継承する。
 * 内部スタックトレースを HTTP レスポンスに漏洩させない設計（NFR-03）。
 */
export class AppError extends Error {
  /** アプリケーション固有エラーコード */
  readonly code: ErrorCode;
  /** HTTP ステータスコード */
  readonly statusCode: number;

  constructor(code: ErrorCode, message?: string, statusCode?: number) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode ?? 500;
    // スタックトレースを Error に正しく紐付ける
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * アプリケーション固有エラーコード
 * Hono エラーハンドラが code を読み取り適切な HTTP レスポンスに変換する
 */
export type ErrorCode =
  | 'TASK_NOT_FOUND'         // 404: タスクが存在しない
  | 'CANDIDATE_NOT_FOUND'    // 404: タスク候補が存在しない
  | 'UNAUTHORIZED'            // 401: JWT 未認証
  | 'TOKEN_EXPIRED'           // 401: JWT 有効期限切れ（Cognito）
  | 'EXTERNAL_API_FAILED'    // 502: Slack API エラー
  | 'BEDROCK_TIMEOUT'        // 504: Bedrock レスポンスタイムアウト（5秒）
  | 'BEDROCK_COST_EXCEEDED'  // 429: Bedrock コスト上限ガード
  | 'DYNAMO_WRITE_FAILED'    // 500: DynamoDB 書き込みエラー
  | 'INVALID_INPUT'           // 400: 入力バリデーションエラー（Zod）
  | 'PERSONA_NOT_FOUND'      // 404: ペルソナが存在しない
  | 'CONNECTION_NOT_FOUND';  // 404: サービス連携が存在しない
```

---

## 2. 特化エラーサブクラス

```typescript
// packages/shared/src/errors/index.ts

import { AppError } from './AppError';

/**
 * Bedrock converse API タイムアウト（NFR-01: 5秒上限）
 * タイムアウト時はユーザーに「再試行」トースト通知を表示する
 */
export class BedrockTimeoutError extends AppError {
  constructor(message = 'Bedrock API response timed out (5s limit)') {
    super('BEDROCK_TIMEOUT', message, 504);
    this.name = 'BedrockTimeoutError';
  }
}

/**
 * Bedrock トークンコスト上限超過（NFR-06: 月間コスト $50 上限）
 * guardTokenLimit() によるプリフライト確認で事前防止
 * 上限超過時は graceful degradation（提案なし状態でタスク表示継続）
 */
export class BedrockCostExceededError extends AppError {
  constructor(message = 'Bedrock token cost limit exceeded') {
    super('BEDROCK_COST_EXCEEDED', message, 429);
    this.name = 'BedrockCostExceededError';
  }
}

/**
 * Cognito JWT 有効期限切れ
 * フロントエンドは 401 受信時に自動リフレッシュを試みる
 */
export class TokenExpiredError extends AppError {
  constructor(message = 'Cognito JWT token expired') {
    super('TOKEN_EXPIRED', message, 401);
    this.name = 'TokenExpiredError';
  }
}

/**
 * DynamoDB 書き込み失敗
 * TransactWriteItems の ConditionalCheckFailedException 等をラップ
 */
export class DynamoWriteFailedError extends AppError {
  constructor(message = 'DynamoDB write operation failed') {
    super('DYNAMO_WRITE_FAILED', message, 500);
    this.name = 'DynamoWriteFailedError';
  }
}

// 再エクスポート
export { AppError };
export type { ErrorCode } from './AppError';
```

---

## 3. ULID 生成ルール（Q4 回答）

```typescript
// packages/shared/src/utils/generateUlid.ts

import { ulid } from 'ulidx';
// Q4 回答: ulidx npm パッケージを使用
// 理由: ブラウザ/Node.js 両環境対応、crypto.getRandomValues() ベース

/**
 * ULID（Universally Unique Lexicographically Sortable Identifier）を生成する
 * DynamoDB SK の時刻ソート可能な一意 ID として使用
 *
 * 使用箇所:
 * - TaskCandidate 作成: SK = TASK_CAND#<ulid>
 * - Task 作成: SK = TASK#<ulid>
 * - HonneData 作成時の一意性保証（SK は ISO8601 だが衝突防止に内部で使用可）
 */
export function generateUlid(): string {
  return ulid();
}
```

**ビジネスルール**:
- TaskCandidate 作成時は必ず `generateUlid()` で SK を生成する
- TaskCandidate を Task へ変換する際は**新しい** ULID を生成する（候補 ID を引き継がない）
- ULID は大文字 Crockford's Base32 形式（26 文字）

---

## 4. 仮名化ルール（Q5 回答）

```typescript
// packages/shared/src/utils/pseudonymize.ts

import { createHash } from 'crypto';
// Q5 回答: SHA-256 ハッシュ化、Node.js crypto 標準モジュール

/**
 * 依頼者名を SHA-256 ハッシュ値で仮名化する（NFR-07 プライバシー保護）
 *
 * 設計方針:
 * - Slack メッセージの依頼者（user_id / display_name）を DynamoDB に保存する前に仮名化
 * - ハッシュは不可逆。元の氏名は DynamoDB に保存しない
 * - ソルトは環境変数 PSEUDONYMIZE_SALT から取得（未設定時はエラー）
 *
 * @param name 元の依頼者名または Slack user_id
 * @returns SHA-256 ハッシュ値（hex, 64文字）
 * @throws AppError('INVALID_INPUT') ソルトが未設定の場合
 */
export function pseudonymize(name: string): string {
  const salt = process.env.PSEUDONYMIZE_SALT;
  if (!salt) {
    throw new AppError(
      'INVALID_INPUT',
      'PSEUDONYMIZE_SALT environment variable is required',
      500,
    );
  }
  return createHash('sha256').update(salt + name).digest('hex');
}
```

**ビジネスルール**:
- TaskCandidate.requester および Task.requester は必ず `pseudonymize()` を通してから保存する
- Slack API から取得した `user_id` または `username` をそのまま DynamoDB に書かない
- `PSEUDONYMIZE_SALT` は AWS Systems Manager Parameter Store または Secrets Manager で管理（aws-constraints.md）

---

## 5. トークン制限ルール（Q8 回答）

```typescript
// packages/shared/src/utils/guardTokenLimit.ts

/**
 * デフォルトトークン上限（Q8 回答）
 * 環境変数 MAX_TOKEN_LIMIT で上書き可能
 */
export const DEFAULT_MAX_TOKEN_LIMIT = 8000;

/**
 * テキストの概算トークン数を計算する
 * 日本語: 1文字 ≒ 1.5トークン、英数字: 1文字 ≒ 0.25トークン で概算
 *
 * @param text トークン数を計算するテキスト
 * @returns 概算トークン数
 */
export function countTokens(text: string): number {
  // 日本語文字（ひらがな・カタカナ・漢字・全角記号）を判定
  const japaneseCharCount = (text.match(/[　-鿿＀-￯]/g) ?? []).length;
  const otherCharCount = text.length - japaneseCharCount;
  return Math.ceil(japaneseCharCount * 1.5 + otherCharCount * 0.25);
}

/**
 * テキストが指定トークン上限を超える場合に末尾を切り捨てて返す
 * Bedrock converse API 呼び出し前のプリフライトガード（NFR-01, NFR-06）
 *
 * @param prompt Bedrock に送るプロンプト
 * @param limit トークン上限（未指定時: DEFAULT_MAX_TOKEN_LIMIT または環境変数）
 * @returns トークン上限内に収めたプロンプト
 */
export function guardTokenLimit(prompt: string, limit?: number): string {
  const effectiveLimit =
    limit ??
    (process.env.MAX_TOKEN_LIMIT
      ? parseInt(process.env.MAX_TOKEN_LIMIT, 10)
      : DEFAULT_MAX_TOKEN_LIMIT);

  if (countTokens(prompt) <= effectiveLimit) {
    return prompt;
  }

  // バイナリサーチで切り捨て位置を特定
  let low = 0;
  let high = prompt.length;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (countTokens(prompt.slice(0, mid)) <= effectiveLimit) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return prompt.slice(0, low);
}
```

**ビジネスルール**:
- SaboriProposerAgent / TaskExtractorAgent は Bedrock 呼び出し前に必ず `guardTokenLimit()` を実行する
- 環境変数 `MAX_TOKEN_LIMIT` が設定されていない場合は `DEFAULT_MAX_TOKEN_LIMIT = 8000` を使用する
- `countTokens(prompt) > effectiveLimit` の場合に `BedrockCostExceededError` を throw するかどうかは呼び出し元（Agent 側）が判断する

---

## 6. 日時ユーティリティルール

```typescript
// packages/shared/src/utils/datetime.ts

/**
 * ISO 8601 日時を日本語の自然な表現に変換する（FR-03 表示用）
 *
 * 変換ルール:
 * - 当日: 「今日 HH:mm」
 * - 翌日: 「明日 HH:mm」
 * - 2日後以降: 「M月D日 HH:mm」
 * - null: 「締切なし」
 *
 * @example formatDeadline('2026-05-18T14:00:00Z') → '明日 23:00'（JST換算）
 */
export function formatDeadline(isoDate: string | null): string {
  if (!isoDate) return '締切なし';
  // UTC → JST（+9h）変換
  const date = new Date(isoDate);
  const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);

  const diffDays = Math.floor(
    (jstDate.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24),
  );

  const timeStr = new Date(isoDate).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });

  if (diffDays === 0) return `今日 ${timeStr}`;
  if (diffDays === 1) return `明日 ${timeStr}`;
  const dateStr = new Date(isoDate).toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  });
  return `${dateStr} ${timeStr}`;
}

/**
 * 現在時刻から指定日時までの残り分数を返す
 *
 * @returns 正の値: 未来（残り分数）、負の値: 過去（超過分数）
 */
export function minutesUntil(isoDate: string): number {
  return Math.floor((new Date(isoDate).getTime() - Date.now()) / (1000 * 60));
}

/**
 * 締切が過ぎているかどうか
 */
export function isOverdue(isoDate: string): boolean {
  return minutesUntil(isoDate) < 0;
}

/**
 * 現在時刻を ISO 8601 文字列で返す
 */
export function toIsoString(date: Date = new Date()): string {
  return date.toISOString();
}
```

---

## 7. Zod バリデーションスキーマルール

各エンティティの入力バリデーションは Zod スキーマで実装する。主要なルールを定義する。

```typescript
// packages/shared/src/schemas/task.ts

import { z } from 'zod';

/**
 * タスク手動追加リクエストのバリデーション
 * POST /api/tasks のリクエストボディ検証に使用
 */
export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'タスク名は必須です').max(200, 'タスク名は200文字以内です'),
  deadline: z
    .string()
    .datetime({ message: '締切は ISO 8601 形式で指定してください' })
    .nullable()
    .optional(),
  description: z.string().max(1000, '作業内容は1000文字以内です').optional(),
});

/**
 * タスク更新リクエストのバリデーション
 * PATCH /api/tasks/:id のリクエストボディ検証に使用
 */
export const UpdateTaskSchema = CreateTaskSchema.partial();

/**
 * 本音データ記録リクエストのバリデーション
 * POST /api/tasks/:id/honne のリクエストボディ検証に使用
 */
export const CreateHonneSchema = z.object({
  type: z.enum(['quick_reply', 'free_text']),
  content: z.union([
    z.enum(['truly_tired', 'actually_important', 'agree_with_ai', 'disagree_with_ai']),
    z.string().min(1).max(500),
  ]),
});
```

**バリデーションルール**:
- タスク名: 必須、最大 200 文字
- 締切: ISO 8601 形式または null（任意項目）
- 作業内容: 最大 1000 文字（任意項目）
- 本音フリーテキスト: 最大 500 文字
- Zod の parse エラーは `AppError('INVALID_INPUT', message, 400)` に変換してから throw する

---

## 8. ビジネスルール制約一覧

| ルール ID | 対象 | ルール内容 | 関連要件 |
|----------|------|----------|---------|
| BR-01 | TaskCandidate | 新規候補は必ず `status: 'pending'` で作成する | FR-01 |
| BR-02 | TaskCandidate → Task | 承認時は `TransactWriteItems` で原子操作する（候補削除 + タスク追加） | FR-02 |
| BR-03 | Task | 削除は物理削除せず `status: 'deleted'` に論理削除する | FR-02 |
| BR-04 | ULID | TaskCandidate と Task はそれぞれ独立した ULID を持つ（変換時に新規生成） | FR-01, FR-02 |
| BR-05 | pseudonymize | 依頼者名は DynamoDB 保存前に必ず SHA-256 仮名化する | NFR-07 |
| BR-06 | PSEUDONYMIZE_SALT | 仮名化ソルトは環境変数から取得。未設定時はエラー | NFR-03 |
| BR-07 | guardTokenLimit | Bedrock 呼び出し前のプロンプトは必ずトークン上限チェックを通す | NFR-01, NFR-06 |
| BR-08 | ServiceConnection | トークン実体は DynamoDB に保存しない。secretArn のみ保持する | NFR-03 |
| BR-09 | Verdict | サボり判定は `'can_saboru'` / `'borderline'` / `'must_do'` の3値のみ | FR-03, FR-04 |
| BR-10 | QuickReplyType | クイック返信は4値固定（`'truly_tired'` / `'actually_important'` / `'agree_with_ai'` / `'disagree_with_ai'`） | FR-05 |
| BR-11 | AppError | エラーレスポンスに内部スタックトレースを含めない | NFR-03 |
| BR-12 | MAX_TOKEN_LIMIT | 環境変数未設定時は `DEFAULT_MAX_TOKEN_LIMIT = 8000` を使用する | NFR-06 |
| BR-13 | TTL | TaskCandidate の TTL は作成日から 30 日後（Unix タイムスタンプ） | NFR-05 |
| BR-14 | PersonaType | MVP v1.0.0 で使用するペルソナは `'saboru'`（personaId: `'saboru_ottori'`）固定 | FR-04 |
