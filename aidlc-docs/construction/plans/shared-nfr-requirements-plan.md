# NFR Requirements 実行プラン — U-01: shared

**Unit**: U-01: shared  
**ステージ**: CONSTRUCTION / NFR Requirements  
**作成日**: 2026-05-17  
**参照**:
- `aidlc-docs/construction/shared/functional-design/domain-entities.md`
- `aidlc-docs/construction/shared/functional-design/business-rules.md`
- `aidlc-docs/construction/shared/functional-design/business-logic-model.md`
- `aidlc-docs/inception/requirements/requirements.md` NFR-01〜NFR-11

---

## 実行チェックリスト

- [x] Step 1: Functional Design 成果物の分析
- [x] Step 2: NFR アセスメントプランの作成（本ファイル）
- [ ] Step 3: ユーザーへの確認質問提示・回答収集
- [ ] Step 4: NFR Requirements 成果物生成
  - [ ] `aidlc-docs/construction/shared/nfr-requirements/nfr-requirements.md`
  - [ ] `aidlc-docs/construction/shared/nfr-requirements/tech-stack-decisions.md`
- [ ] Step 5: ユーザー承認取得
- [ ] Step 6: audit.md 記録 / aidlc-state.md 更新

---

## Step 1: Functional Design 分析結果

### shared パッケージの特性

`packages/shared` は以下を提供する純粋な TypeScript ライブラリ：

| カテゴリ | 内容 |
|---------|------|
| 型定義 | 7エンティティ（User / ServiceConnection / TaskCandidate / Task / Proposal / HonneData / Persona）|
| エラークラス | AppError 基底 + 4つの特化サブクラス |
| リポジトリインタフェース | 6つのインタフェース（DynamoDB CRUD + GSI クエリ）|
| ユーティリティ | generateUlid / pseudonymize / guardTokenLimit / datetime 関数群 |
| バリデーション | Zod スキーマ（CreateTaskSchema / UpdateTaskSchema / CreateHonneSchema）|
| 定数 | VERDICT_TYPE / QUICK_REPLY_TYPE / DDB_PREFIX 等 |

### NFR に関連するビジネスルール（business-rules.md より）

- **BR-05/BR-06**: pseudonymize() でソルトが必要 → セキュリティ上の重要な依存
- **BR-07/BR-12**: guardTokenLimit() → トークン数制御（コスト管理）
- **BR-08**: secretArn のみ DynamoDB 保持 → セキュリティ設計
- **BR-11**: エラーレスポンスにスタックトレースを含めない → セキュリティ

### NFR アセスメント対象カテゴリ

| カテゴリ | shared への影響度 | 備考 |
|---------|----------------|------|
| パフォーマンス | 中（ユーティリティ関数の処理時間） | countTokens / pseudonymize のアルゴリズム |
| スケーラビリティ | 低（状態を持たない純粋関数主体） | 外部依存なし |
| セキュリティ | 高（仮名化・エラー情報漏洩防止） | PSEUDONYMIZE_SALT 管理 |
| テスト容易性 | 高（純粋関数主体 → テストしやすい） | カバレッジ 80%+ 要件 |
| 型安全性 | 高（TypeScript strict mode） | any 原則禁止 |
| パッケージサイズ | 中（フロントエンドからも import）| Tree-shaking 対応要否 |

---

## Step 2: 確認質問（[Answer]: タグ形式）

shared パッケージの NFR を最適化するため、以下を確認します。

---

### Q-NFR-S1: テストカバレッジ目標（パフォーマンス・保守性）

`packages/shared` は純粋関数・型・インタフェースが主体で、単体テストが書きやすい構造です。
`requirements.md` NFR-08 では「主要ロジック 80%以上」とされていますが、shared パッケージについてはどの範囲を優先しますか？

**A**: ユーティリティ関数全体で 90%以上（`pseudonymize` / `guardTokenLimit` / `datetime` すべてを網羅）  
**B**: ビジネスルールに直結する関数のみ 80%以上（`pseudonymize` / `guardTokenLimit` を優先。`datetime` は軽め）  
**C**: ハッカソン工数を考慮し、最重要の `pseudonymize` / `guardTokenLimit` のみテスト。それ以外はスキップ  
**D**: 型・インタフェースは実行コードがないのでテスト対象外。ユーティリティ全体で 80% を目標とする

[Answer]: 

---

### Q-NFR-S2: パッケージビルド形式（フロントエンド連携）

`packages/shared` は `pkgs/backend` / `pkgs/agent` だけでなく `pkgs/frontend`（React）からも型をインポートします。
ビルド形式について確認します。

**A**: CommonJS（CJS）のみでビルドする。フロントエンドは Vite がよしなに変換する  
**B**: ESM（ES Modules）のみでビルドする。Tree-shaking を活かしたい  
**C**: デュアルビルド（CJS + ESM）。backend/agent は CJS、frontend は ESM を使い分ける  
**D**: ビルドしない（`pkgs/shared` を `src/` 直参照の TypeScript プロジェクト参照のみで使う）

[Answer]: 

---

### Q-NFR-S3: `PSEUDONYMIZE_SALT` の管理方法（セキュリティ）

`pseudonymize()` 関数はソルトを `process.env.PSEUDONYMIZE_SALT` から取得します（BR-06）。
ローカル開発環境とデプロイ環境でのソルト管理方法を確認します。

**A**: ローカル開発: `.env` ファイルで管理（`.gitignore` に追加）。本番: AWS Systems Manager Parameter Store（SecureString）  
**B**: ローカル開発: `.env` ファイルで管理。本番: AWS Secrets Manager  
**C**: ローカル開発: ダミー値をコードにコメントで記載。本番: AWS Systems Manager Parameter Store  
**D**: ローカル開発・本番ともに AWS Systems Manager Parameter Store（CDK でデプロイ時に取得）

[Answer]: 

---

### Q-NFR-S4: `countTokens()` の精度要件（コスト管理）

現在の `countTokens()` は簡易推定（日本語: 1文字≒1.5トークン）ですが、Bedrock の実際のトークン数と乖離が生じる場合があります。
コスト管理（NFR-06）の観点から、どの程度の精度が必要ですか？

**A**: 現行の簡易推定で十分。多少の乖離は許容（ハッカソン規模では問題ない）  
**B**: Bedrock の `amazon.titan-text-express-v1` などのトークナイザを参考に精度を上げたい  
**C**: `guardTokenLimit()` で切り捨てるため精度より安全側（過大推定）に振った実装にする  
**D**: ユニットテストで既知のテキストに対する推定値を検証し、20%以内の誤差を保証する

[Answer]: 

---

### Q-NFR-S5: Zod バリデーションエラーの変換方式（エラーハンドリング）

`CreateTaskSchema.parse()` が失敗した場合、`ZodError` を `AppError('INVALID_INPUT', message, 400)` に変換するとあります。
エラーメッセージの詳細度について確認します。

**A**: Zod の詳細なエラー情報（フィールド名・メッセージ）をそのままフロントエンドに返す（開発効率優先）  
**B**: エラーフィールド名のみ返し、Zod 内部メッセージは含めない（セキュリティ考慮）  
**C**: 「入力内容に誤りがあります」等の汎用メッセージのみ返す（情報漏洩ゼロ）  
**D**: 開発環境では詳細なエラー、本番環境では汎用メッセージ（`NODE_ENV` で切り替え）

[Answer]: 

---

### Q-NFR-S6: 型エクスポートの粒度（保守性・循環依存防止）

`packages/shared` は `pkgs/backend` / `pkgs/agent` / `pkgs/frontend` から参照されます。
型エクスポートの粒度について確認します。

**A**: 現状設計通り — `src/types/index.ts` から全型を一括 re-export する  
**B**: 用途別にサブパス exports を設定する（例: `@saboru/shared/types` / `@saboru/shared/utils` / `@saboru/shared/errors`）  
**C**: フロントエンド向けと バックエンド向けでエントリーポイントを分ける（型汚染防止）  
**D**: package.json の `exports` フィールドは使わず、`tsconfig paths` のみで解決する

[Answer]: 

---
