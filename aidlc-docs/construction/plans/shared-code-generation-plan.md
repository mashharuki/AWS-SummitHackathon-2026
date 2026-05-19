# Code Generation Plan — U-01: shared

**Unit**: U-01: shared
**ステージ**: CONSTRUCTION / Code Generation
**作成日**: 2026-05-17
**バージョン**: 1.0.0
**ファストトラック・品質最大化方針**

---

## ユニットコンテキスト

- **ユニット概要**: `@saboru/shared` — ランタイムなし純粋TypeScriptライブラリ
- **配置先**: `pkgs/shared/`
- **サブパス**: `@saboru/shared`, `@saboru/shared/types`, `@saboru/shared/utils`, `@saboru/shared/errors`
- **依存Unit**: なし（循環依存防止のため他pkgに依存しない）
- **被依存**: pkgs/backend, pkgs/agent, pkgs/frontend（型のみ）

## 参照設計書

- `aidlc-docs/construction/shared/functional-design/domain-entities.md`
- `aidlc-docs/construction/shared/functional-design/business-rules.md`
- `aidlc-docs/construction/shared/functional-design/business-logic-model.md`
- `aidlc-docs/construction/shared/nfr-design/nfr-design-patterns.md`

---

## コード生成計画

### Step 1: プロジェクト構造セットアップ
- [x] `pkgs/shared/` ディレクトリ作成
- [x] `pkgs/shared/package.json` 作成（CJS/ESM デュアルビルド、subpath exports）
- [x] `pkgs/shared/tsconfig.json` 作成
- [x] `pkgs/shared/tsup.config.ts` 作成（esbuildベースデュアルビルド）
- [x] `pkgs/shared/vitest.config.ts` 作成（カバレッジ閾値90%）
- [x] `pkgs/shared/.env.example` 作成

### Step 2: 型定義生成（@saboru/shared/types）
- [x] `pkgs/shared/src/types/enums.ts` — Verdict/QuickReplyType/SourceType 等
- [x] `pkgs/shared/src/types/user.ts` — User インタフェース
- [x] `pkgs/shared/src/types/service-connection.ts` — ServiceConnection インタフェース
- [x] `pkgs/shared/src/types/task-candidate.ts` — TaskCandidate インタフェース
- [x] `pkgs/shared/src/types/task.ts` — Task インタフェース
- [x] `pkgs/shared/src/types/proposal.ts` — Proposal インタフェース
- [x] `pkgs/shared/src/types/honne-data.ts` — HonneData インタフェース
- [x] `pkgs/shared/src/types/persona.ts` — Persona インタフェース
- [x] `pkgs/shared/src/types/index.ts` — 全型の re-export

### Step 3: エラークラス生成（@saboru/shared/errors）
- [x] `pkgs/shared/src/errors/AppError.ts` — 基底エラークラス＋ErrorCode型
- [x] `pkgs/shared/src/errors/index.ts` — 4サブクラス＋型ガード＋re-export

### Step 4: ユーティリティ関数生成（@saboru/shared/utils）
- [x] `pkgs/shared/src/utils/generateUlid.ts` — ulidxによるULID生成
- [x] `pkgs/shared/src/utils/pseudonymize.ts` — SHA-256仮名化
- [x] `pkgs/shared/src/utils/guardTokenLimit.ts` — countTokens/guardTokenLimit
- [x] `pkgs/shared/src/utils/datetime.ts` — 日時ユーティリティ（JST対応）
- [x] `pkgs/shared/src/utils/index.ts` — 全ユーティリティの re-export

### Step 5: リポジトリインタフェース生成
- [x] `pkgs/shared/src/repositories/IUserRepository.ts`
- [x] `pkgs/shared/src/repositories/IServiceConnectionRepository.ts`
- [x] `pkgs/shared/src/repositories/ITaskCandidateRepository.ts`
- [x] `pkgs/shared/src/repositories/ITaskRepository.ts`
- [x] `pkgs/shared/src/repositories/IProposalRepository.ts`
- [x] `pkgs/shared/src/repositories/IHonneRepository.ts`
- [x] `pkgs/shared/src/repositories/index.ts` — 全インタフェースの re-export

### Step 6: Zodスキーマ生成
- [x] `pkgs/shared/src/schemas/task.ts` — CreateTaskSchema/UpdateTaskSchema
- [x] `pkgs/shared/src/schemas/honne.ts` — CreateHonneSchema
- [x] `pkgs/shared/src/schemas/index.ts` — re-export

### Step 7: 定数定義生成
- [x] `pkgs/shared/src/constants/index.ts` — VERDICT_TYPE/DDB_PREFIX/DEFAULT_PERSONA_ID等

### Step 8: パッケージルートエクスポート
- [x] `pkgs/shared/src/index.ts` — 全エクスポートのルート

### Step 9: テストコード生成（Vitest、カバレッジ90%以上）
- [x] `pkgs/shared/src/errors/__tests__/AppError.test.ts`
- [x] `pkgs/shared/src/utils/__tests__/generateUlid.test.ts`
- [x] `pkgs/shared/src/utils/__tests__/pseudonymize.test.ts`
- [x] `pkgs/shared/src/utils/__tests__/guardTokenLimit.test.ts`（既知値10件、±20%精度）
- [x] `pkgs/shared/src/utils/__tests__/datetime.test.ts`
- [x] `pkgs/shared/src/schemas/__tests__/schemas.test.ts`

### Step 10: ビルド・テスト実行
- [x] `pnpm install`（ワークスペースルートで実行）
- [x] `pnpm --filter shared build` — tsupビルド確認
- [x] `pnpm --filter shared test` — Vitestテスト確認（カバレッジ90%以上）
- [x] ビルド/テスト失敗時の修正

### Step 11: コードサマリドキュメント作成
- [x] `aidlc-docs/construction/shared/code/code-generation-summary.md` 作成

---

## ストーリーカバレッジ

本Unitが実装するユーザーストーリー:
- AG-01, AG-02: TaskExtractorAgent / SaboriProposerAgent が使用する型・ユーティリティ
- US-01〜US-10: 全ストーリーの共通型基盤（pkgs/backend / pkgs/api 経由で利用）

---

## 技術仕様

| 項目 | 仕様 |
|------|------|
| ビルドツール | tsup 8.x（esbuildベース） |
| テストフレームワーク | Vitest 2.x |
| リンター/フォーマッター | Biome 1.9.4（ルートbiome.json準拠） |
| Node.js | v22.14.0（.node-version準拠） |
| パッケージマネージャ | pnpm 10.33.0 workspaces |
| 出力形式 | CJS（.cjs）+ ESM（.mjs）+ 型定義（.d.ts） |
