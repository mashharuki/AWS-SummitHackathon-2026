# ビジネスロジックモデル — U-04: api

**Unit**: U-04: api
**ステージ**: CONSTRUCTION / Functional Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. アーキテクチャ概要

### 1.1 レイヤー構成

```
[API Gateway HTTP API / JWT Authorizer]
        |
[Lambda: saborou-api-{env}]
        |
[Hono App (src/index.ts)]
        |
  ┌─────┴──────┐
  │ Middleware  │  auth (userId 抽出) / logger / error-handler
  └─────┬──────┘
        |
  ┌─────┴──────────────────────────────────────────────────┐
  │                    Routes                               │
  │  /api/auth/*   /api/tasks/*   /api/connections/*       │
  │  /webhooks/*   /health                                 │
  └─────┬──────────────────────────────────────────────────┘
        |
  ┌─────┴──────┐
  │  Handlers  │  6 ハンドラファイル（BE-01〜BE-06 対応）
  └─────┬──────┘
        |
  ┌─────┴──────────────────────────────────────────────────┐
  │                 Repository Adapters                     │
  │  DynamoTaskRepository / DynamoProposalRepository etc.  │
  │  （pkgs/agent の実装クラスを再利用 + 新規追加）         │
  └─────┬──────────────────────────────────────────────────┘
        |
  [DynamoDB / Secrets Manager / EventBridge / SaboriProposerAgent]
```

### 1.2 ファイル構成（pkgs/backend/src）

```
src/
├── index.ts                  # Hono app factory + route registration
├── handler.ts                # Lambda entry point（hono/aws-lambda handle）
├── middleware/
│   ├── auth.ts               # JWT userId 抽出ミドルウェア
│   ├── error-handler.ts      # グローバルエラーハンドラ
│   └── logger.ts             # 構造化ログミドルウェア
├── routes/
│   ├── health.ts             # GET /health
│   ├── auth.ts               # POST /api/auth/exchange-token
│   ├── tasks.ts              # タスク・候補 CRUD + 承認
│   ├── proposals.ts          # GET /api/tasks/:id/proposal (SSE)
│   ├── honne.ts              # POST /api/tasks/:id/honne
│   ├── connections.ts        # GET/POST/DELETE /api/connections/*
│   └── webhooks.ts           # POST /webhooks/slack
├── repositories/
│   ├── DynamoUserRepository.ts
│   ├── DynamoServiceConnectionRepository.ts
│   ├── DynamoTaskCandidateRepository.ts  # pkgs/agent から再利用可能か検討
│   ├── DynamoTaskRepository.ts
│   ├── DynamoHonneRepository.ts
│   └── index.ts
├── services/
│   ├── slack-oauth.ts        # Slack OAuth コールバック処理
│   └── honne-reply.ts        # 本音返答固定文言生成
└── config/
    ├── env.ts                # 環境変数型安全アクセス
    └── openapi.ts            # OpenAPI ドキュメント（更新）
```

---

## 2. 主要ビジネスフロー

### 2.1 タスク一覧取得フロー

```
GET /api/tasks?status=pending or approved
  │
  ├─ [auth middleware] JWT → userId 抽出
  │
  ├─ status=pending
  │    └─ ITaskCandidateRepository.findAllByUserId(userId)
  │         └─ DynamoDB: Query PK=USER#<userId> SK begins_with TASK_CAND#
  │
  └─ status=approved (デフォルト)
       └─ ITaskRepository.findApprovedByUserId(userId)
            └─ DynamoDB: Query GSI-UserStatus userId=USER#<userId> status=approved
```

### 2.2 タスク候補承認フロー（BR-API-02）

```
POST /api/tasks/candidates/:candidateId/approve
  │
  ├─ [auth middleware] userId 取得
  ├─ ITaskCandidateRepository.approve(userId, candidateId)
  │    └─ DynamoDB TransactWriteItems:
  │         ├─ Delete: TaskCandidates PK=USER#<userId> SK=TASK_CAND#<id>
  │         └─ Put: Tasks PK=USER#<userId> SK=TASK#<new-ulid> status=approved
  └─ 200 Task
```

### 2.3 サボり提案取得フロー（BR-API-04）

```
GET /api/tasks/:taskId/proposal[?stream=true]
  │
  ├─ [auth middleware] userId 取得
  ├─ ITaskRepository.findById(userId, taskId)  → 所有者確認
  ├─ IProposalRepository.findLatestByTaskId(taskId)
  │    │
  │    ├─ proposal.nextCheckAt > now() → キャッシュ HIT
  │    │    ├─ stream=false: return c.json(proposal)
  │    │    └─ stream=true: SSE で proposal の各フィールドを配信
  │    │
  │    └─ キャッシュ MISS or 期限切れ
  │         ├─ SaboriProposerAgent を呼び出す
  │         │    （pkgs/agent の ISaboriProposerAgent インタフェース経由）
  │         ├─ stream=false: await agent.propose(context) → c.json()
  │         └─ stream=true: streamSSE(c, async (stream) => {
  │               for await (const delta of agent.proposeStream(context)) {
  │                 await stream.writeSSE({ data: JSON.stringify(delta) })
  │               }
  │             })
  └─ 200 / SSE stream
```

### 2.4 Slack Webhook 受信フロー（BE-06）

```
POST /webhooks/slack
  │
  ├─ [署名検証] verifySlackSignature(req)
  │    ├─ X-Slack-Signature 欠如 → 401
  │    ├─ タイムスタンプ 5分超 → 403 (replay attack)
  │    └─ HMAC 不一致 → 403
  │
  ├─ type=url_verification → return { challenge }
  │
  └─ type=event_callback
       └─ EventBridgeClient.putEvents({
            Source: 'saborou.webhook',
            DetailType: 'SlackEvent',
            Detail: JSON.stringify(normalizedEvent)
          })
         → return { ok: true }
```

### 2.5 本音データ記録フロー（BR-API-06）

```
POST /api/tasks/:taskId/honne
  │
  ├─ [auth middleware] userId 取得
  ├─ ITaskRepository.findById(userId, taskId) → 所有者確認
  ├─ [Zod 検証] type / content
  ├─ IHonneRepository.save({ userId, taskId, type, content, createdAt })
  └─ return { saved: true, reply: pickReply(), visionText: VISION_TEXT }
```

---

## 3. ミドルウェアスタック

```typescript
// src/index.ts（実装イメージ）
const app = new Hono<AppEnv>()

// グローバルミドルウェア
app.use('*', logger())
app.use('*', requestId())

// エラーハンドラ
app.onError(errorHandler)
app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Not Found' } }, 404))

// 公開エンドポイント（認証不要）
app.route('/health', healthRoute)
app.route('/webhooks', webhookRoute)

// 保護エンドポイント
const api = new Hono<AppEnv>()
api.use('*', authMiddleware)  // userId 抽出
api.route('/auth', authRoute)
api.route('/tasks', taskRoute)
api.route('/tasks', proposalRoute)  // :id/proposal サブルート
api.route('/tasks', honneRoute)     // :id/honne サブルート
api.route('/connections', connectionRoute)

app.route('/api', api)
```

---

## 4. userId 抽出ロジック（Hono on Lambda）

API Gateway HTTP API + JWT Authorizer の場合、Lambda イベントの `requestContext.authorizer.jwt.claims` に Cognito クレームが注入される。

```typescript
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { handle } from 'hono/aws-lambda'

const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  // API Gateway HTTP API が注入するコンテキスト
  const event = c.env as APIGatewayProxyEventV2WithJWTAuthorizer
  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub
  if (!sub) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing userId' } }, 401)
  }
  c.set('userId', sub)
  await next()
})
```

---

## 5. SSE ストリーミング実装方針

Lambda Response Streaming は Function URL 専用のため、API Gateway 経由の SSE には通常の Hono `streamSSE` を使用する。
ただし API Gateway の統合タイムアウト（29秒）に収まるよう設計する。

```typescript
// src/routes/proposals.ts
import { streamSSE } from 'hono/streaming'

proposalRoute.get('/:taskId/proposal', authMiddleware, async (c) => {
  const stream_param = c.req.query('stream')
  if (stream_param === 'true') {
    return streamSSE(c, async (stream) => {
      for await (const delta of agent.proposeStream(context)) {
        await stream.writeSSE({
          data: JSON.stringify(delta),
          event: delta.type,
        })
        if (delta.type === 'done') break
      }
    })
  }
  // 非ストリーミング
  const proposal = await agent.propose(context)
  return c.json(proposal)
})
```

---

## 6. エラーハンドリング統一

```typescript
// src/middleware/error-handler.ts
export const errorHandler = (err: Error, c: Context) => {
  // pkgs/shared の既知エラー型をマッピング
  if (err instanceof NotFoundError) {
    return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404)
  }
  if (err instanceof ValidationError) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: err.message } }, 400)
  }
  if (err instanceof ForbiddenError) {
    return c.json({ error: { code: 'FORBIDDEN', message: err.message } }, 403)
  }
  // 未知エラーは詳細を隠蔽
  console.error('[UNHANDLED_ERROR]', { error: err.message, stack: err.stack })
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }, 500)
}
```

---

## 7. エンドポイント完全一覧

| # | Method | Path | Handler | 認証 | 説明 |
|---|--------|------|---------|------|------|
| 1 | GET | /health | health | なし | ヘルスチェック |
| 2 | POST | /api/auth/exchange-token | auth | なし | Cognito コード→JWT |
| 3 | GET | /api/tasks | tasks | JWT | タスク一覧（候補/承認済み） |
| 4 | POST | /api/tasks | tasks | JWT | 手動タスク追加 |
| 5 | GET | /api/tasks/:id | tasks | JWT | タスク単一取得 |
| 6 | PATCH | /api/tasks/:id | tasks | JWT | タスク更新 |
| 7 | DELETE | /api/tasks/:id | tasks | JWT | タスク論理削除 |
| 8 | POST | /api/tasks/candidates/:id/approve | tasks | JWT | 候補承認 |
| 9 | DELETE | /api/tasks/candidates/:id | tasks | JWT | 候補削除 |
| 10 | GET | /api/tasks/:id/proposal | proposals | JWT | サボり提案取得（SSE対応） |
| 11 | POST | /api/tasks/:id/honne | honne | JWT | 本音データ記録 |
| 12 | GET | /api/connections | connections | JWT | 連携一覧 |
| 13 | POST | /api/connections/slack/callback | connections | JWT | Slack OAuth コールバック |
| 14 | DELETE | /api/connections/:service | connections | JWT | 連携解除 |
| 15 | POST | /webhooks/slack | webhooks | 署名検証 | Slack Webhook 受信 |
