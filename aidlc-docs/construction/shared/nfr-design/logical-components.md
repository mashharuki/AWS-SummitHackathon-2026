# 論理コンポーネント定義 — U-01: shared

**Unit**: U-01: shared
**ステージ**: CONSTRUCTION / NFR Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0
**参照**:
- `nfr-design-patterns.md`（本ディレクトリ）
- `nfr-requirements/tech-stack-decisions.md`
- `functional-design/business-logic-model.md`

---

## 概要

本ドキュメントでは NFR 要件を満たすために `@saboru/shared` が内部に持つ論理コンポーネントを定義する。
インフラ依存なし（ランタイムなし）のため、論理コンポーネントはすべてビルド時・テスト時のツール群と
ソースコードモジュールで構成される。

---

## 1. ビルドパイプラインコンポーネント

### LC-B1: tsup ビルドエンジン

| 項目 | 内容 |
|------|------|
| 役割 | CJS / ESM デュアルフォーマット + `.d.ts` の生成 |
| NFR | NFR-S2（デュアルビルド）/ NFR-S6（サブパス exports） |
| 入力 | `src/{index,types/index,utils/index,errors/index}.ts`（4 エントリポイント） |
| 出力 | `dist/{*.cjs,*.mjs,*.d.ts}` |
| 設定ファイル | `tsup.config.ts` |
| ツールチェーン | tsup（内部: esbuild）+ `tsc --emitDeclarationOnly`（型定義生成） |
| CI 統合 | `pnpm build` → CI でビルド成果物の存在チェック |

```
[src/ エントリポイント × 4]
        |
        v
   [tsup ビルドエンジン]
        |
        ├── [esbuild トランスパイル] → *.cjs / *.mjs
        └── [tsc dts 生成]         → *.d.ts
        |
        v
   [dist/ 出力]
```

### LC-B2: publint / attw 検証コンポーネント

| 項目 | 内容 |
|------|------|
| 役割 | `package.json exports` フィールドの正確性を検証 |
| NFR | NFR-S6（サブパス exports の整合性） |
| 実行タイミング | CI（ビルド後）または `pnpm build` の post-script |
| ツール | `publint`（exports 検証）、`@arethetypeswrong/cli`（型解決検証） |

---

## 2. テストフレームワークコンポーネント

### LC-T1: Vitest テストランナー

| 項目 | 内容 |
|------|------|
| 役割 | ユニットテストの実行・カバレッジ計測・閾値強制 |
| NFR | NFR-S1（カバレッジ 90%）/ NFR-S4（トークン精度 20% 以内） |
| 設定ファイル | `vitest.config.ts` |
| カバレッジプロバイダ | `@vitest/coverage-v8`（V8 ネイティブ） |
| 閾値設定 | `coverage.thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 }` |
| 対象ディレクトリ | `src/utils/`（pseudonymize / guardTokenLimit / datetime / generateUlid） |
| 除外対象 | `src/**/*.d.ts`、`src/**/index.ts`（re-export ファイル） |

```
[pnpm test --coverage]
        |
        v
  [Vitest 4.1.6]
        |
        ├── [テストファイル実行] src/**/__tests__/*.test.ts
        └── [@vitest/coverage-v8 カバレッジ計測]
              |
              ├── lines ≥ 90%   → pass
              ├── branches ≥ 90% → pass
              └── 閾値未満       → exit 1（CI ブロック）
```

### LC-T2: トークン精度テストコンポーネント

| 項目 | 内容 |
|------|------|
| 役割 | `countTokens()` / `guardTokenLimit()` の推定精度を既知値で検証 |
| NFR | NFR-S4（誤差 20% 以内保証） |
| テストファイル | `src/utils/__tests__/guardTokenLimit.test.ts` |
| テストケース数 | 最低 10 件（英語・日本語・混合・空文字・極長） |
| アサーション方式 | `Math.abs(estimated - actual) / actual <= 0.20` |

---

## 3. セキュリティコンポーネント

### LC-S1: 環境変数検証コンポーネント（pseudonymize 内部）

| 項目 | 内容 |
|------|------|
| 役割 | `PSEUDONYMIZE_SALT` 環境変数の存在を実行時に検証 |
| NFR | NFR-S3（シークレット未設定時のフェイルファスト） |
| 実装 | `pseudonymize()` 関数内のガード節 |
| 動作 | 未設定時: `AppError('INVALID_INPUT', 'PSEUDONYMIZE_SALT is not set', 500)` を throw |

```
[pseudonymize(name) 呼び出し]
        |
        v
  [LC-S1: 環境変数検証]
        |
        ├── PSEUDONYMIZE_SALT 設定済み → SHA-256(salt + name) を返す
        └── PSEUDONYMIZE_SALT 未設定  → AppError を throw（フェイルファスト）
```

### LC-S2: .env.example テンプレートコンポーネント

| 項目 | 内容 |
|------|------|
| 役割 | ローカル開発時に必要な環境変数を明示 |
| NFR | NFR-S3（開発者向け安全なシークレット管理ガイド） |
| ファイル | `pkgs/shared/.env.example`（リポジトリにコミット） |

---

## 4. エラーハンドリングコンポーネント

### LC-E1: AppError 基底クラス

| 項目 | 内容 |
|------|------|
| 役割 | `code` / `details` / `serialize()` を統一実装する基底クラス |
| NFR | NFR-S5（環境別メッセージ分離） |
| ファイル | `src/errors/AppError.ts` |
| 主要メソッド | `serialize(): SerializedError`（NODE_ENV で分岐） |

### LC-E2: 特化エラーサブクラス群

| クラス | エラーコード | HTTP ステータス |
|--------|------------|----------------|
| `BedrockTimeoutError` | `BEDROCK_TIMEOUT` | 504 |
| `BedrockCostExceededError` | `BEDROCK_COST_EXCEEDED` | 429 |
| `TokenExpiredError` | `TOKEN_EXPIRED` | 401 |
| `DynamoWriteFailedError` | `DYNAMO_WRITE_FAILED` | 500 |

| 項目 | 内容 |
|------|------|
| 役割 | エラー種別を型で表現し、pkgs/api での HTTP ステータスマッピングを型安全にする |
| NFR | NFR-S5（型ガードによる catch ブロックの安全な分岐） |
| ファイル | `src/errors/index.ts` |

### LC-E3: isAppError 型ガード

| 項目 | 内容 |
|------|------|
| 役割 | `catch(e: unknown)` を AppError へ型安全に絞り込む |
| NFR | NFR-S5（消費側の安全なエラーハンドリング支援） |
| ファイル | `src/errors/AppError.ts`（`export function isAppError(e: unknown): e is AppError`） |

---

## 5. コード品質コンポーネント

### LC-Q1: Biome リント / フォーマットコンポーネント

| 項目 | 内容 |
|------|------|
| 役割 | コードスタイルの統一・静的解析 |
| 設定ファイル | `biome.json`（プロジェクトルート） |
| CI 統合 | `pnpm biome check --write=false`（フォーマット違反で exit 1） |

---

## 6. 論理コンポーネント相関図

```
ビルド時:
  [LC-B1: tsup ビルドエンジン]
        └── [LC-B2: publint/attw 検証]

テスト時:
  [LC-T1: Vitest テストランナー]
        └── [LC-T2: トークン精度テスト]

実行時（消費側 Lambda / Vite）:
  [@saboru/shared/utils]
        └── [LC-S1: 環境変数検証] ← pseudonymize 内部
  [@saboru/shared/errors]
        ├── [LC-E1: AppError 基底]
        ├── [LC-E2: 特化エラーサブクラス]
        └── [LC-E3: isAppError 型ガード]
  [@saboru/shared/types]  ← 型消去後は不要（フロントエンドバンドル最小化）
```

---

## 7. コンポーネント実装優先度

| 優先度 | コンポーネント | 理由 |
|--------|-------------|------|
| 1 | LC-E1 / LC-E2 / LC-E3（エラー） | 他コンポーネントが依存する基盤 |
| 2 | LC-B1（tsup ビルド設定） | 消費側パッケージがビルドを参照するため最初に完成させる |
| 3 | LC-S1（pseudonymize ガード） | セキュリティ要件（フェイルファスト） |
| 4 | LC-T1 / LC-T2（テスト設定） | カバレッジ閾値設定と精度テストケース実装 |
| 5 | LC-Q1（Biome） | プロジェクト既存設定を継承するのみ |
| 6 | LC-B2（publint 検証） | ビルド後の品質確認（任意・推奨） |
| 7 | LC-S2（.env.example） | 開発者向けドキュメント（最後に追加） |
