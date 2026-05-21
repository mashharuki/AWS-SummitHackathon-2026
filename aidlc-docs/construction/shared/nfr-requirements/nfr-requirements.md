# NFR 要件定義 — U-01: shared

**Unit**: U-01: shared  
**ステージ**: CONSTRUCTION / NFR Requirements  
**作成日**: 2026-05-17  
**バージョン**: 1.0.0  
**参照**: Q-NFR-S1〜S6 ユーザー回答（2026-05-17）、品質最大化方針（プロダクション品質優先）

---

## 方針確認

ユーザーが明言した優先方針:
> 「時間の制約は一旦気にせず、できるだけ高いレベルで仕上げたい」

本ドキュメントの全要件は**工数削減よりプロダクション品質を優先**して定義する。
以降の全 Construction ステージにおいてもこの方針を適用する。

---

## 1. テスト要件（NFR-S1）

### NFR-S1: テストカバレッジ

**回答**: A — ユーティリティ関数全体で 90% 以上のテストカバレッジ

| 項目 | 要件 |
|------|------|
| カバレッジ閾値 | 90% 以上（ライン / ブランチ / 関数の全指標） |
| 対象 | `pseudonymize` / `guardTokenLimit` / `datetime` ユーティリティ全関数 |
| テストフレームワーク | Vitest 4.1.6（プロジェクト統一） |
| 計測ツール | `@vitest/coverage-v8` |
| 閾値の強制 | `vitest.config.ts` の `coverage.thresholds` に設定し CI で自動検証 |

**補足**: エラーケース・境界値・エッジケースを網羅すること。型ガードの条件分岐も含むブランチカバレッジを達成する。

---

## 2. ビルド形式要件（NFR-S2 / NFR-S6）

### NFR-S2: デュアルビルド（CJS + ESM）

**回答**: C — デュアルビルド CJS + ESM

| 消費側 | 形式 |
|--------|------|
| `pkgs/backend/` / `pkgs/agent/` | CJS（`require()` ベース、Lambda 実行環境） |
| `pkgs/frontend/` | ESM（Vite/Next.js バンドラ最適化） |

**ビルドツール**: tsup を採用

```json
// package.json の主要フィールド
{
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
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

### NFR-S6: サブパス Exports

**回答**: B — 用途別サブパス exports（NFR-S2 のデュアルビルドと整合）

| サブパス | 内容 |
|----------|------|
| `@saboru/shared` | メインエントリ（全エクスポートの re-export） |
| `@saboru/shared/types` | エンティティ型・列挙型のみ |
| `@saboru/shared/utils` | ユーティリティ関数のみ |
| `@saboru/shared/errors` | エラークラス階層のみ |

**設計方針**: 消費側が必要な部分のみインポートできるように分割し、バンドルサイズを最小化する。特に `@saboru/shared/types` は型定義のみのため、型消去後のランタイムバンドルに不要なコードを含まない。

---

## 3. シークレット管理要件（NFR-S3）

**回答**: A — 環境別の二重管理

| 環境 | 管理方法 |
|------|---------|
| ローカル開発 | `.env` ファイル（`.gitignore` 対象、リポジトリに含めない） |
| 本番（AWS Lambda） | AWS Systems Manager Parameter Store SecureString |

**対象シークレット**:

| シークレット名 | 用途 | SSM パス |
|-------------|------|---------|
| `PSEUDONYMIZE_SALT` | `pseudonymize()` の SHA-256 ソルト | `/saboru/prod/pseudonymize-salt` |
| `MAX_TOKEN_LIMIT` | Bedrock トークン上限（環境変数での上書き） | `/saboru/prod/max-token-limit` |

**実装要件**:
- `pkgs/shared/` にシークレット値をハードコードしない
- ローカル開発用 `.env.example` を提供し、必要な環境変数を明示
- Lambda 実行時は SSM Parameter Store から実行時取得（または環境変数経由でインジェクト）

---

## 4. トークン推定精度要件（NFR-S4）

**回答**: D — ユニットテストで既知テキストへの推定値を検証し、20% 以内の誤差を保証

| 項目 | 要件 |
|------|------|
| 精度保証 | 実際のトークン数との誤差 20% 以内 |
| 検証方法 | ユニットテストで既知テキスト（英語・日本語・混合）に対して推定値を実測 |
| 推定アルゴリズム | 文字数ベース推定（日本語: `chars * 2` / 英語: `chars / 4`） |
| テストケース | 最低10件の既知テキストサンプルを用意 |
| テスト実行 | CI で `vitest` 実行時に自動検証 |

**補足**: `guardTokenLimit` は Bedrock API の呼び出し前に必ず通過するため、過剰推定（20% 超）よりも不足推定（実際よりも少なく見積もる）の方がリスクが高い。テストケースは日本語テキストを重点的に網羅する。

---

## 5. エラーハンドリング要件（NFR-S5）

**回答**: D — 環境別エラーメッセージ分離（NODE_ENV による切り替え）

| 環境 | エラーメッセージ | スタックトレース |
|------|---------------|----------------|
| 開発（`NODE_ENV=development`） | 詳細なメッセージ（エラーコード・コンテキスト含む） | 出力あり |
| 本番（`NODE_ENV=production`） | 汎用メッセージ（`An unexpected error occurred.`） | 出力なし |

**実装要件**:

```typescript
// AppError のシリアライズ仕様
interface SerializedError {
  code: string;         // 常に含む（クライアント向けエラーハンドリング用）
  message: string;     // 環境別の内容
  details?: unknown;   // development のみ
  stack?: string;      // development のみ
}

class AppError extends Error {
  serialize(): SerializedError {
    const isdev = process.env.NODE_ENV === 'development';
    return {
      code: this.code,
      message: isDev ? this.message : 'An unexpected error occurred.',
      ...(isDev && { details: this.details, stack: this.stack }),
    };
  }
}
```

**ログ方針**: 本番環境でもサーバーサイドログ（CloudWatch）には詳細情報を記録する。`serialize()` はクライアントレスポンス用であり、内部ロギングとは別に管理する。

---

## 6. NFR サマリ

| ID | カテゴリ | 要件 | 優先度 |
|----|---------|------|--------|
| NFR-S1 | テスト | ユーティリティ関数全体 90% 以上カバレッジ | Must |
| NFR-S2 | ビルド | デュアルビルド CJS + ESM（tsup） | Must |
| NFR-S3 | セキュリティ | .env（ローカル）/ SSM Parameter Store SecureString（本番） | Must |
| NFR-S4 | 精度 | `guardTokenLimit` 誤差 20% 以内（ユニットテスト保証） | Must |
| NFR-S5 | エラー | NODE_ENV で development/production のメッセージ分離 | Must |
| NFR-S6 | パッケージ設計 | サブパス exports（types / utils / errors）× デュアルビルド整合 | Must |

---

## 7. 品質最大化方針の適用範囲

本方針は U-01: shared に限らず、以降の全 Unit（U-02: infra / U-03a: task-extractor / U-03b: sabori-proposer / U-04: api / U-05: web）にも適用する。各 Unit の NFR Requirements ドキュメントにも同様の方針を明記する。
