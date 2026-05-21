# NFR 設計パターン — U-01: shared

**Unit**: U-01: shared
**ステージ**: CONSTRUCTION / NFR Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0
**参照**:
- `nfr-requirements/nfr-requirements.md`（NFR-S1〜S6）
- `nfr-requirements/tech-stack-decisions.md`
- `functional-design/business-logic-model.md`

---

## 概要

`@saboru/shared` はランタイムを持たない純粋な TypeScript ライブラリである。
そのため Resilience・Scalability パターン（Circuit Breaker / Retry / HPA 等）はすべて N/A。
本ドキュメントでは以下 4 カテゴリの NFR 設計パターンを定義する：

1. テスト設計パターン（NFR-S1）
2. ビルド設計パターン（NFR-S2 / NFR-S6）
3. セキュリティ設計パターン（NFR-S3）
4. エラーハンドリング設計パターン（NFR-S5）

---

## 1. テスト設計パターン（NFR-S1）

### 1.1 カバレッジ強制パターン

**目的**: ユーティリティ関数全体で 90% 以上のカバレッジを CI で強制する。

**パターン**: Threshold Enforcement Pattern

```
vitest.config.ts
  └── coverage.thresholds（lines / branches / functions / statements = 90）
        └── CI: `pnpm test --coverage` が閾値未満で exit 1
```

**適用対象**: `src/utils/` 配下の全ファイル（generateUlid / pseudonymize / guardTokenLimit / datetime）

**テスト戦略**:

| テスト種別 | 対象 | 手法 |
|-----------|------|------|
| 正常系テスト | 全ユーティリティ関数 | 境界値・代表値で入出力検証 |
| ブランチカバレッジテスト | 条件分岐を持つ関数 | 各ブランチを個別テストケースで網羅 |
| エラーケーステスト | throw する関数 | `expect(() => fn()).toThrow(AppError)` |
| 精度テスト | `countTokens` / `guardTokenLimit` | 既知テキスト 10 件の推定精度を ±20% 以内で検証 |
| 型ガードテスト | 型チェック関数（将来追加時） | 型境界の条件分岐をブランチカバレッジで計測 |

### 1.2 トークン推定精度テストパターン（NFR-S4）

**目的**: `guardTokenLimit` の誤差 20% 以内を自動検証する。

**パターン**: Known-Value Assertion Pattern

```typescript
// テストケース構造
interface TokenTestCase {
  label: string;       // 例: "日本語20文字"
  text: string;        // テスト入力テキスト
  actualTokens: number; // 実測トークン数（Bedrock Claude で実測した既知値）
  tolerance: 0.20;     // 許容誤差 20%
}

// アサーション
const estimated = countTokens(tc.text);
const diff = Math.abs(estimated - tc.actualTokens) / tc.actualTokens;
expect(diff).toBeLessThanOrEqual(tc.tolerance);
```

**テストケース構成**（最低 10 件）:

| # | テキスト種別 | 説明 |
|---|------------|------|
| 1 | 英語のみ（短文） | 20 単語程度 |
| 2 | 英語のみ（長文） | 200 単語程度 |
| 3 | 日本語のみ（短文） | 20 文字程度 |
| 4 | 日本語のみ（長文） | 200 文字程度 |
| 5 | 日本語＋絵文字 | 日本語 + 絵文字混在 |
| 6 | 英日混在（英語優勢） | 英語 60% / 日本語 40% |
| 7 | 英日混在（日本語優勢） | 日本語 70% / 英語 30% |
| 8 | 空文字列 | edge case: `""` → 0 |
| 9 | 記号・数字のみ | `1234567890!@#$%` |
| 10 | 極長テキスト | 8000 文字超（切り捨て動作確認） |

---

## 2. ビルド設計パターン（NFR-S2 / NFR-S6）

### 2.1 デュアルビルドパターン

**目的**: CJS（Lambda/Node.js）と ESM（Vite/Next.js）の双方から消費可能にする。

**パターン**: Dual-Format Package Pattern

```
tsup（esbuild ベース）
  ├── 入力エントリポイント（4つ）
  │     ├── src/index.ts          → dist/index.{cjs,mjs}
  │     ├── src/types/index.ts   → dist/types/index.{cjs,mjs}
  │     ├── src/utils/index.ts   → dist/utils/index.{cjs,mjs}
  │     └── src/errors/index.ts  → dist/errors/index.{cjs,mjs}
  └── 出力
        ├── *.cjs     → CommonJS（require() / Lambda）
        ├── *.mjs     → ESModule（import / Vite）
        └── *.d.ts    → TypeScript 型定義（dts: true）
```

**package.json exports フィールド設計**:

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./types": {
      "import": "./dist/types/index.mjs",
      "require": "./dist/types/index.cjs",
      "types": "./dist/types/index.d.ts"
    },
    "./utils": {
      "import": "./dist/utils/index.mjs",
      "require": "./dist/utils/index.cjs",
      "types": "./dist/utils/index.d.ts"
    },
    "./errors": {
      "import": "./dist/errors/index.mjs",
      "require": "./dist/errors/index.cjs",
      "types": "./dist/errors/index.d.ts"
    }
  }
}
```

### 2.2 サブパス exports パターン（NFR-S6）

**目的**: 消費側が必要な部分のみをインポートし、バンドルサイズを最小化する。

**パターン**: Selective Export Pattern

| サブパス | 内容 | 消費側 |
|---------|------|--------|
| `@saboru/shared` | 全エクスポートの re-export | 内部ユーティリティが全部必要な場合 |
| `@saboru/shared/types` | 型定義のみ | pkgs/frontend（型消去後バンドルに不要） |
| `@saboru/shared/utils` | ユーティリティ関数のみ | pkgs/agent（pseudonymize / guardTokenLimit 等） |
| `@saboru/shared/errors` | AppError クラス階層のみ | pkgs/backend / pkgs/agent（エラーハンドリング） |

**ビルド検証**: `exports` フィールドの各パスに対して `pnpm publint` または `attw` で自動検証。

---

## 3. セキュリティ設計パターン（NFR-S3）

### 3.1 環境別シークレット分離パターン

**目的**: シークレット値をコードにハードコードせず、環境別に安全に管理する。

**パターン**: Environment-Segregated Secret Pattern

```
ローカル開発環境:
  .env（.gitignore 対象）
    PSEUDONYMIZE_SALT=<ランダム文字列 32 バイト以上>
    MAX_TOKEN_LIMIT=8000
  ↓ dotenv.config() で process.env に注入

本番環境（AWS Lambda）:
  SSM Parameter Store SecureString
    /saboru/prod/pseudonymize-salt  ← KMS 暗号化
    /saboru/prod/max-token-limit
  ↓ Lambda 環境変数経由（CDK が SSM から取得して inject）
       または SDK 実行時取得（低レイテンシ要件のない場合）
```

**フェイルファスト設計**: `pseudonymize()` は `PSEUDONYMIZE_SALT` 未設定時に AppError を即 throw する。
環境変数未設定のまま Bedrock 呼び出しに進まないための防御的プログラミング。

### 3.2 .env.example テンプレートパターン

**目的**: 新規開発者が必要な環境変数を把握できるようにする。

**成果物**: `pkgs/shared/.env.example`

```bash
# @saboru/shared — 必須環境変数

# SHA-256 ハッシュ化のソルト（最低 32 バイトのランダム文字列）
# 生成方法: openssl rand -hex 32
PSEUDONYMIZE_SALT=

# Bedrock 最大トークン数（省略時: 8000）
MAX_TOKEN_LIMIT=8000
```

---

## 4. エラーハンドリング設計パターン（NFR-S5）

### 4.1 環境別メッセージ分離パターン

**目的**: クライアントへのエラーレスポンスから、本番環境の内部情報を隠蔽する。

**パターン**: Environment-Aware Error Serialization Pattern

```
AppError.serialize()
  ├── NODE_ENV === 'development'
  │     → { code, message: <詳細メッセージ>, details, stack }
  └── NODE_ENV === 'production'
        → { code, message: 'An unexpected error occurred.' }
                              ↑ クライアントに返す汎用メッセージ

サーバーサイドログ（CloudWatch）:
  → 常に詳細情報を記録（serialize() とは独立）
```

### 4.2 AppError クラス階層パターン

**目的**: エラー種別を型で表現し、catch ブロックでの分岐を型安全にする。

**パターン**: Typed Error Hierarchy Pattern

```
Error（標準）
  └── AppError（基底 — code / details / serialize() を定義）
        ├── BedrockTimeoutError     code: 'BEDROCK_TIMEOUT'     HTTP: 504
        ├── BedrockCostExceededError code: 'BEDROCK_COST_EXCEEDED' HTTP: 429
        ├── TokenExpiredError       code: 'TOKEN_EXPIRED'       HTTP: 401
        └── DynamoWriteFailedError  code: 'DYNAMO_WRITE_FAILED' HTTP: 500
```

**エラーコード規則**:
- `SCREAMING_SNAKE_CASE`
- カテゴリプレフィックス（`BEDROCK_` / `DYNAMO_` / `TOKEN_` / `INVALID_`）
- pkgs/api がエラーコードを参照して HTTP ステータスコードにマッピングする

### 4.3 型ガードパターン

**目的**: catch(e) の `unknown` 型を AppError へ安全に絞り込む。

```typescript
export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

// 使用例（pkgs/backend / pkgs/api）
try {
  await repo.save(data);
} catch (e) {
  if (isAppError(e)) {
    logger.error({ code: e.code, details: e.details });
    return res.status(e.httpStatus).json(e.serialize());
  }
  throw e; // 未知エラーは上位に伝播
}
```

---

## 5. N/A カテゴリの根拠

| カテゴリ | 判定 | 理由 |
|---------|------|------|
| Resilience Patterns | N/A | shared はランタイムなし。Retry / Circuit Breaker は pkgs/agent / pkgs/backend が担う |
| Scalability Patterns | N/A | ライブラリ単体にスケーリング概念なし。Lambda のコンカレンシーは U-02 infra / U-04 api のスコープ |
| Messaging / Queueing | N/A | shared は EventBridge / SQS を使用しない |

---

## 6. パターン適用サマリ

| NFR 要件 | 適用パターン | 実装場所 |
|---------|------------|---------|
| NFR-S1: カバレッジ 90% | Threshold Enforcement Pattern | `vitest.config.ts` + CI |
| NFR-S4: トークン誤差 20% | Known-Value Assertion Pattern | `src/utils/__tests__/guardTokenLimit.test.ts` |
| NFR-S2: デュアルビルド | Dual-Format Package Pattern | `tsup.config.ts` + `package.json exports` |
| NFR-S6: サブパス exports | Selective Export Pattern | `package.json exports` |
| NFR-S3: シークレット管理 | Environment-Segregated Secret Pattern | `.env` / SSM / `.env.example` |
| NFR-S5: エラーメッセージ分離 | Environment-Aware Error Serialization Pattern | `AppError.serialize()` |
| NFR-S5 型安全 | Typed Error Hierarchy Pattern | `src/errors/` |
