# U-04: api — コード生成計画

**Unit**: U-04: api
**ステージ**: CONSTRUCTION / Code Generation
**作成日**: 2026-05-17
**バージョン**: 1.0.0
**方針**: ファストトラック・品質最大化（時間制約なし）

---

## ユニットコンテキスト

### 担当ユーザーストーリー
- US-07: タスク一覧取得・候補承認（GET /api/tasks, GET /api/tasks/candidates, POST /api/tasks/candidates/:id/approve）
- US-08: タスク CRUD（POST /api/tasks, PATCH /api/tasks/:id, DELETE /api/tasks/:id）
- US-09: サボり提案 SSE ストリーミング（GET /api/tasks/:id/proposal?stream=true）
- US-10: 本音データ記録（POST /api/tasks/:id/honne）
- US-11: Slack OAuth 連携（GET /api/auth/slack, GET /api/auth/slack/callback）
- US-12: 接続管理（GET /api/connections, DELETE /api/connections/:service）
- US-13: Slack Webhook 受信・HMAC 検証・EventBridge 転送

### 依存ユニット
- U-01 (@saboru/shared): 型・リポジトリインタフェース・スキーマ・定数
- U-02 (pkgs/cdk): ApiStack・WebhookStack の CDK 定義
- U-03b (@saboru/agent): SaboriProposerAgent・ProposalDelta

### 担当 DynamoDB テーブル（Read/Write）
- Users, ServiceConnections, TaskCandidates（Write追加）, Tasks, Proposals（Read）, HonneData

---

## Step 1: types.ts / errors.ts 作成
- [x] `pkgs/backend/src/types.ts` — HonoVariables / AppEnv / Bindings 型定義
- [x] `pkgs/backend/src/errors.ts` — AppError / NotFoundError / ForbiddenError / ConflictError / UnauthorizedError

## Step 2: middleware 作成（3ファイル）
- [x] `pkgs/backend/src/middleware/auth.ts` — JWT claim 抽出・userId 伝播
- [x] `pkgs/backend/src/middleware/error-handler.ts` — グローバルエラーハンドラ
- [x] `pkgs/backend/src/middleware/logger.ts` — リクエストロガー（CloudWatch 構造化ログ）

## Step 3: config 作成（2ファイル）
- [x] `pkgs/backend/src/config/env.ts` — 環境変数検証・型付きアクセサ
- [x] `pkgs/backend/src/config/secrets.ts` — Secrets Manager モジュールスコープキャッシュ

## Step 4: services 作成（2ファイル）
- [x] `pkgs/backend/src/services/slack-verification.ts` — HMAC 署名検証（timingSafeEqual）
- [x] `pkgs/backend/src/services/honne-reply.ts` — 本音タイプ別返信テキスト生成

## Step 5: repositories 作成（6ファイル）
- [x] `pkgs/backend/src/repositories/DynamoUserRepository.ts`
- [x] `pkgs/backend/src/repositories/DynamoServiceConnectionRepository.ts`
- [x] `pkgs/backend/src/repositories/DynamoTaskCandidateRepository.ts`
- [x] `pkgs/backend/src/repositories/DynamoTaskRepository.ts`
- [x] `pkgs/backend/src/repositories/DynamoProposalRepository.ts`
- [x] `pkgs/backend/src/repositories/DynamoHonneRepository.ts`

## Step 6: routes 作成（7ファイル）
- [x] `pkgs/backend/src/routes/health.ts` — GET /health
- [x] `pkgs/backend/src/routes/auth.ts` — GET /auth/slack, GET /auth/slack/callback
- [x] `pkgs/backend/src/routes/tasks.ts` — GET/POST /tasks, GET/PATCH/DELETE /tasks/:id
- [x] `pkgs/backend/src/routes/proposals.ts` — GET /tasks/:id/proposal（SSE）
- [x] `pkgs/backend/src/routes/honne.ts` — POST /tasks/:id/honne
- [x] `pkgs/backend/src/routes/connections.ts` — GET /connections, DELETE /connections/:service
- [x] `pkgs/backend/src/routes/webhooks.ts` — POST /webhooks/slack（HMAC + EventBridge）

## Step 7: エントリポイント更新
- [x] `pkgs/backend/src/index.ts` — Hono app factory（全ルート登録、ミドルウェア設定）
- [x] `pkgs/backend/src/handler.ts` — API Lambda エントリ（handle(app)）
- [x] `pkgs/backend/src/webhook-handler.ts` — Webhook Lambda エントリ（別アプリ）

## Step 8: OpenAPI 定義更新
- [x] `pkgs/backend/src/config/openapi.ts` — 15エンドポイントの完全な OpenAPI 3.0 定義

## Step 9: package.json 更新
- [x] `pkgs/backend/package.json` — ビルドスクリプト（2エントリ）・依存関係追加

## Step 10: tsconfig.json 更新
- [x] `pkgs/backend/tsconfig.json` — パスエイリアス等調整

## Step 11: vitest.config.ts 更新
- [x] `pkgs/backend/vitest.config.ts` — カバレッジ設定・テスト対象設定

## Step 12: テストファイル作成（9ファイル）
- [x] `pkgs/backend/src/__tests__/routes/health.test.ts`
- [x] `pkgs/backend/src/__tests__/routes/auth.test.ts`
- [x] `pkgs/backend/src/__tests__/routes/tasks.test.ts`
- [x] `pkgs/backend/src/__tests__/routes/proposals.test.ts`
- [x] `pkgs/backend/src/__tests__/routes/honne.test.ts`
- [x] `pkgs/backend/src/__tests__/routes/connections.test.ts`
- [x] `pkgs/backend/src/__tests__/routes/webhooks.test.ts`
- [x] `pkgs/backend/src/__tests__/services/slack-verification.test.ts`
- [x] `pkgs/backend/src/__tests__/middleware/auth.test.ts`

## Step 13: CDK api-stack.ts 更新
- [x] `pkgs/cdk/lib/stacks/api-stack.ts` — 環境変数3件追加・IAM権限修正

## Step 14: pnpm install 実行
- [x] ワークスペースルートで pnpm install

## Step 15: build 実行
- [x] `pkgs/backend` で pnpm build（2エントリポイント）

## Step 16: test 実行・パス確認
- [x] `pkgs/backend` で vitest --coverage（目標: Statements 90%+, Branches 85%+）
- [x] `pkgs/cdk` で テスト実行（既存テスト継続パス確認）

## Step 17: ドキュメント作成
- [x] `aidlc-docs/construction/api/code/code-summary.md` — コード生成サマリ

---

## 技術方針

| 項目 | 方針 |
|------|------|
| フレームワーク | Hono v4 (hono/aws-lambda) |
| バリデーション | @hono/zod-validator + zod（@saboru/shared のスキーマ再利用）|
| SSE | hono/streaming の streamSSE |
| HMAC 検証 | Node.js crypto.timingSafeEqual |
| Secrets Manager | モジュールスコープキャッシュ（コールドスタート時のみ取得）|
| EventBridge | fire-and-forget（await putPromise）|
| ログ | 構造化 JSON（CloudWatch Logs Insights 対応）|
| テスト | vitest + hono/testing の testClient |
| カバレッジ | v8 プロバイダ |
