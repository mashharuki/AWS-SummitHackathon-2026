# コードスタイルと規約（2026-05-16 更新）

## 一般規約
- **フォーマッター/Linter**: Biome（@biomejs/biome ^1.9.4）— prettier/eslint は使わない
- コードレビュー: CodeRabbit（日本語自動PR レビュー）
- コミットメッセージ: Conventional Commits 形式（`feat:`, `fix:`, `docs:`, `refactor:` 等）

## 言語・モジュール設定
- **TypeScript**: strict モード必須
- **backend tsconfig**: ESNext + Bundler moduleResolution + jsxImportSource: "hono/jsx"
- **frontend tsconfig**: Vite 標準設定（tsconfig.app.json + tsconfig.node.json）
- **CDK tsconfig**: 標準 CDK TypeScript 設定

## ファイル配置規約
- **アプリケーションコード**: `pkgs/` 配下のみ（backend / frontend / cdk）
- **ドキュメント**: `aidlc-docs/` 配下のみ
- **AI設定**: `.claude/` 配下
- **aidlc-docs/ にコードを置くことは厳禁**

## パッケージ管理
- **pnpm** 専用（npm/yarn 使用禁止）
- pnpm workspace で monorepo 管理
- パッケージ名: `backend`, `frontend`, `cdk`

## コーディング規約（SABOROU 固有）

### バックエンド (Hono)
- Lambda ハンドラ: `src/handler.ts` で `handle(app)` でラップ
- Hono アプリ本体: `src/index.ts`（デフォルトエクスポート）
- OpenAPI 定義: `src/config/openapi.ts`
- ESM (`"type": "module"`)

### フロントエンド (React + Vite)
- ESM モジュール形式
- React 19 の新機能（`use`, Server Components 等）を活用可
- shadcn/ui（Construction フェーズで追加予定）
- Three.js（U-05 実装時に追加予定）

### CDK
- スタック定義: `lib/` 配下
- エントリーポイント: `bin/cdk.ts`
- L2/L3 コンストラクト優先（L1 はやむを得ない場合のみ）
- スタック分割: CognitoStack / DataStack / ApiStack / AgentStack / FrontendStack / WebhookStack

## AI-DLC プロセス規約
- AGENTS.md を最初に読む（最高優先度）
- 各フェーズ完了前にユーザー承認が必要
- audit.md に全ユーザー入力を完全な形で記録（要約禁止）
- チェックボックスは作業完了と同時に更新
- タイムスタンプは ISO 8601 形式（YYYY-MM-DDTHH:MM:SSZ）

## タスク完了時の確認事項
1. audit.md にログを追記（APPEND ONLY）
2. aidlc-state.md を更新
3. チェックボックスを更新
4. ユーザー承認を取得してから次フェーズへ
