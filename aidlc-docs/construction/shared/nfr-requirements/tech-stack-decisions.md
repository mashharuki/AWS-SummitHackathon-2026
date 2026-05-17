# 技術スタック決定 — U-01: shared

**Unit**: U-01: shared  
**ステージ**: CONSTRUCTION / NFR Requirements  
**作成日**: 2026-05-17  
**バージョン**: 1.0.0  
**参照**: Q-NFR-S1〜S6 ユーザー回答（2026-05-17）

---

## 1. ビルドツール

### 採用: tsup

| 項目 | 決定 | 理由 |
|------|------|------|
| ビルドツール | **tsup** | CJS + ESM デュアルビルド + `.d.ts` 生成を単一設定で実現。esbuild ベースで高速。 |
| バンドルターゲット | Node.js 18 以上 | Lambda 実行環境（Node.js 20.x）と開発環境（Node.js v23）の共通最小公倍数 |
| TypeScript コンパイル | tsup 内蔵 esbuild トランスパイル + `tsc --emitDeclarationOnly` で型定義生成 | 型安全性を担保しつつ高速ビルド |

**tsup 設定方針**:

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'types/index': 'src/types/index.ts',
    'utils/index': 'src/utils/index.ts',
    'errors/index': 'src/errors/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
```

---

## 2. テストツール

### 採用: Vitest 4.1.6 + @vitest/coverage-v8

| 項目 | 決定 | 理由 |
|------|------|------|
| テストフレームワーク | **Vitest 4.1.6** | プロジェクト統一（.nvmrc の Node.js v23 対応済み）。ESM ネイティブ対応。 |
| カバレッジプロバイダ | **@vitest/coverage-v8** | V8 ネイティブカバレッジで高速。ブランチ・行・関数の全カバレッジ計測可能。 |
| カバレッジ閾値 | 90%（ライン / ブランチ / 関数） | Q-NFR-S1 回答（A）に基づく |

**vitest.config.ts の閾値設定**:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
    },
  },
});
```

---

## 3. ULID 生成

### 採用: ulidx

| 項目 | 決定 | 理由 |
|------|------|------|
| ULID ライブラリ | **ulidx** | Q-NFR-S4 / Functional Design Q4 回答（B）。Web Crypto API ベースで Node.js / ブラウザ両環境対応。ESM / CJS デュアルビルドとの相性が良い。 |

---

## 4. シークレット管理

### 採用: dotenv（ローカル）+ AWS SSM Parameter Store（本番）

| 環境 | ツール | 詳細 |
|------|--------|------|
| ローカル開発 | **dotenv** | `.env` ファイルを `process.env` に注入。`.gitignore` で管理。 |
| 本番（Lambda） | **AWS SSM Parameter Store SecureString** | KMS 暗号化済み。Lambda 環境変数経由または実行時 SDK 取得。 |

**SSM パス定義**:

| SSM パス | 環境変数名 | 説明 |
|---------|-----------|------|
| `/saboru/prod/pseudonymize-salt` | `PSEUDONYMIZE_SALT` | SHA-256 ハッシュのソルト |
| `/saboru/prod/max-token-limit` | `MAX_TOKEN_LIMIT` | Bedrock 最大トークン数（省略時 8000） |

---

## 5. エラーハンドリング

### 採用: カスタム AppError クラス階層 + NODE_ENV 切り替え

| 項目 | 決定 | 理由 |
|------|------|------|
| エラー基底クラス | **AppError extends Error** | Q-NFR-S5 / Functional Design Q6 回答（A）。code / details / serialize() を統一実装。 |
| 環境別メッセージ | **NODE_ENV による切り替え** | Q-NFR-S5 回答（D）。development で詳細、production で汎用メッセージ。 |

**エラークラス階層**:

```
AppError（基底）
├── BedrockTimeoutError      — Bedrock API タイムアウト（code: BEDROCK_TIMEOUT）
├── BedrockCostExceededError — トークン上限超過（code: BEDROCK_COST_EXCEEDED）
├── TokenExpiredError        — Slack トークン期限切れ（code: TOKEN_EXPIRED）
└── DynamoWriteFailedError   — DynamoDB 書き込みエラー（code: DYNAMO_WRITE_FAILED）
```

---

## 6. パッケージ管理

### 採用: pnpm workspaces（既存プロジェクト統一）

| 項目 | 決定 | 理由 |
|------|------|------|
| パッケージマネージャ | **pnpm@10.33.0** | プロジェクト既存設定（.nvmrc / pnpm-workspace.yaml）に準拠 |
| ワークスペース名 | `@saboru/shared` | `pkgs/shared/package.json` の `name` フィールドに設定 |
| 消費側インポート | `import from '@saboru/shared'` | pnpm workspace の `catalog:` プロトコルで内部参照 |

---

## 7. コードリント / フォーマット

### 採用: Biome 1.9.4（プロジェクト統一）

| 項目 | 決定 | 理由 |
|------|------|------|
| リンター / フォーマッタ | **Biome 1.9.4** | プロジェクト統一（既存設定 `biome.json` に準拠）。ESLint + Prettier 不要。 |
| CI チェック | `pnpm biome check --write=false` | CI でフォーマット違反を検出 |

---

## 8. 技術スタック決定サマリ

| カテゴリ | 採用技術 | バージョン | 決定根拠 |
|---------|---------|----------|---------|
| ビルド | tsup | 最新安定版 | CJS/ESM デュアルビルド + dts 生成 |
| テスト | Vitest + @vitest/coverage-v8 | 4.1.6 | プロジェクト統一、90% 閾値強制 |
| ULID | ulidx | 最新安定版 | Q4 回答（B）、ESM/CJS 両対応 |
| シークレット | dotenv + SSM Parameter Store | - | Q-NFR-S3 回答（A）、環境別管理 |
| エラー | カスタム AppError 階層 | - | Q4 回答（A）、NODE_ENV 切り替え |
| パッケージ管理 | pnpm@10.33.0 workspaces | 10.33.0 | プロジェクト統一 |
| リント/フォーマット | Biome | 1.9.4 | プロジェクト統一 |
| 言語 | TypeScript | 5.x（プロジェクト設定準拠） | プロジェクト統一 |

---

## 9. 他ユニットへの影響

`@saboru/shared` のデュアルビルドと サブパス exports 設計は、以降の全 Unit が依存するため、
**Code Generation ステージで最初に完成させ、他 Unit のビルドが通る状態にしてから次 Unit に進む**こと。

| 影響する Unit | 使用するサブパス |
|-------------|----------------|
| U-03a: task-extractor | `@saboru/shared/types`, `@saboru/shared/errors` |
| U-03b: sabori-proposer | `@saboru/shared/types`, `@saboru/shared/utils`, `@saboru/shared/errors` |
| U-04: api | `@saboru/shared/types`, `@saboru/shared/errors` |
| U-05: web | `@saboru/shared/types` |
