# NFR 設計パターン — U-04: api

**Unit**: U-04: api
**ステージ**: CONSTRUCTION / NFR Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 設計パターン一覧

| # | パターン名 | 解決する NFR | 実装場所 |
|---|-----------|------------|---------|
| 1 | Hono Variables による userId 安全伝播 | NFR-S1 / NFR-P1 | middleware/auth.ts |
| 2 | Zod + @hono/zod-validator 二重防衛 | NFR-S4 | routes/*.ts |
| 3 | Slack HMAC 署名検証（リプレイ攻撃防止） | NFR-S2 | routes/webhooks.ts |
| 4 | Secrets Manager 起動時キャッシュ（モジュールスコープ） | NFR-S3 / NFR-P1 | config/secrets.ts |
| 5 | streamSSE + SaboriProposerAgent イテレータ統合 | NFR-P2 | routes/proposals.ts |
| 6 | グローバルエラーハンドラ + 型付きエラークラス | NFR-R1 | middleware/error-handler.ts |
| 7 | EventBridge fire-and-forget（waitUntil パターン） | NFR-P3 | routes/webhooks.ts |
| 8 | esbuild 単一バンドル + ARM64 | NFR-P1 / NFR-C1 | package.json / CDK |

---

## パターン詳細

### パターン 1: Hono Variables による userId 安全伝播

**問題**: JWT の `sub` クレームをルートハンドラに安全に渡す方法が必要。

**解決策**: Hono の型付き Variables を使い、ミドルウェアで `c.set('userId', sub)` → ハンドラで `c.get('userId')` と型安全にアクセスする。

```typescript
// src/types.ts
export type HonoVariables = { userId: string }
export type AppEnv = { Variables: HonoVariables }

// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types.js'

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  // API Gateway HTTP API v2 が Lambda event に注入するコンテキスト
  // hono/aws-lambda はイベントを c.env として expose する
  const lambdaEvent = c.env as { requestContext?: { authorizer?: { jwt?: { claims?: { sub?: string } } } } }
  const sub = lambdaEvent.requestContext?.authorizer?.jwt?.claims?.sub
  if (!sub) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing userId claim' } }, 401)
  }
  c.set('userId', sub)
  await next()
})
```

**注意**: `hono/aws-lambda` の `LambdaContext` 型拡張で型安全に取得可能。

---

### パターン 2: Zod + @hono/zod-validator 二重防衛

**問題**: 不正入力によるサーバーエラーを防ぎ、わかりやすいエラーメッセージを返す。

**解決策**: `@hono/zod-validator` で宣言的にバリデーションを記述。検証後は `c.req.valid('json')` で型安全な値を取得。

```typescript
// src/routes/tasks.ts
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  description: z.string().max(1000).optional(),
})

tasks.post('/', authMiddleware, zValidator('json', createTaskSchema), async (c) => {
  const body = c.req.valid('json')  // 型: { title: string, deadline?: string | null, description?: string }
  const userId = c.get('userId')
  const task = await taskRepository.create({ userId, ...body })
  return c.json(task, 201)
})
```

**カスタムエラーレスポンス**: `zValidator` の 3 番目引数でデフォルト挙動をオーバーライド:

```typescript
zValidator('json', schema, (result, c) => {
  if (!result.success) {
    return c.json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: result.error.flatten() }
    }, 400)
  }
})
```

---

### パターン 3: Slack HMAC 署名検証

**問題**: 不正な POST リクエストによるイベントインジェクション防止。

**解決策**: Node.js 組み込みの `crypto.createHmac` で実装。Secrets Manager から `SLACK_SIGNING_SECRET` を取得。

```typescript
// src/services/slack-verification.ts
import { createHmac, timingSafeEqual } from 'crypto'

export async function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
  signingSecret: string,
): Promise<boolean> {
  // リプレイ攻撃防止: 5分以内のリクエストのみ許可
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return false
  }
  const baseString = `v0:${timestamp}:${body}`
  const expected = `v0=${createHmac('sha256', signingSecret).update(baseString).digest('hex')}`
  // タイミング攻撃防止: timingSafeEqual を使用
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
```

---

### パターン 4: Secrets Manager 起動時キャッシュ

**問題**: Secrets Manager への毎リクエスト呼び出しはレイテンシとコストを増大させる。

**解決策**: Lambda コンテナのモジュールスコープ変数にキャッシュし、起動時（コールドスタート時）のみ取得する。

```typescript
// src/config/secrets.ts
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'

const client = new SecretsManagerClient({ region: 'ap-northeast-1' })

let slackSigningSecretCache: string | undefined

export async function getSlackSigningSecret(): Promise<string> {
  if (slackSigningSecretCache) return slackSigningSecretCache

  const secretArn = process.env.SLACK_SIGNING_SECRET_ARN
  if (!secretArn) throw new Error('SLACK_SIGNING_SECRET_ARN is not set')

  const result = await client.send(new GetSecretValueCommand({ SecretId: secretArn }))
  slackSigningSecretCache = result.SecretString
  return slackSigningSecretCache!
}
```

---

### パターン 5: streamSSE + SaboriProposerAgent イテレータ統合

**問題**: Bedrock のレスポンスストリームを SSE として配信しつつ、キャッシュヒット時はスキップする。

**解決策**: `streamSSE` の中で `for await...of` により非同期イテレータを消費し、各チャンクを SSE イベントとして送信。

```typescript
// src/routes/proposals.ts
import { streamSSE } from 'hono/streaming'
import type { ISaboriProposerAgent } from '@saboru/agent'

proposals.get('/:taskId/proposal', authMiddleware, async (c) => {
  const { taskId } = c.req.param()
  const userId = c.get('userId')
  const isStream = c.req.query('stream') === 'true'

  // 所有者確認
  const task = await taskRepository.findById(userId, taskId)
  if (!task) return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404)

  // キャッシュ確認
  const cached = await proposalRepository.findLatestByTaskId(taskId)
  if (cached && new Date(cached.nextCheckAt) > new Date()) {
    if (!isStream) return c.json(cached)
    // キャッシュでも stream=true ならば SSE で返す
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: 'verdict', data: JSON.stringify({ type: 'verdict', verdict: cached.verdict }) })
      await stream.writeSSE({ event: 'done', data: JSON.stringify({ type: 'done', proposalId: cached.proposalId }) })
    })
  }

  // 新規生成
  const context = buildProposalContext(task)
  if (!isStream) {
    const proposal = await agent.propose(context)
    return c.json(proposal)
  }

  return streamSSE(c, async (stream) => {
    stream.onAbort(() => console.warn('[SSE] Client disconnected'))
    try {
      for await (const delta of agent.proposeStream(context)) {
        await stream.writeSSE({ event: delta.type, data: JSON.stringify(delta) })
        if (delta.type === 'done') break
      }
    } catch (err) {
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ type: 'error', message: 'Stream failed' }) })
    }
  })
})
```

---

### パターン 6: グローバルエラーハンドラ + 型付きエラークラス

**問題**: 各ルートで個別にエラーハンドリングを書くと重複が増える。

**解決策**: `app.onError` でグローバルハンドラを設定し、カスタムエラークラスで HTTP ステータスを型安全に決定する。

```typescript
// src/errors.ts
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) { super(message) }
}
export class NotFoundError extends AppError {
  constructor(msg = 'Not found') { super(404, 'NOT_FOUND', msg) }
}
export class ForbiddenError extends AppError {
  constructor(msg = 'Forbidden') { super(403, 'FORBIDDEN', msg) }
}
export class ConflictError extends AppError {
  constructor(msg = 'Conflict') { super(409, 'CONFLICT', msg) }
}

// src/middleware/error-handler.ts
export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof AppError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.statusCode as StatusCode)
  }
  console.error('[UNHANDLED]', err)
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }, 500)
}
```

---

### パターン 7: EventBridge fire-and-forget（waitUntil パターン）

**問題**: Slack の 3秒タイムアウトに間に合わせつつ、EventBridge 転送を確実に実行する。

**解決策**: Lambda コンテキストの `callbackWaitsForEmptyEventLoop=false` と `context.callbackWaitsForEmptyEventLoop` を組み合わせ、レスポンスを先に返してから EventBridge を呼び出す。

```typescript
// src/routes/webhooks.ts
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'

const ebClient = new EventBridgeClient({ region: 'ap-northeast-1' })

webhooks.post('/slack', async (c) => {
  // 署名検証（同期的に実行）
  const rawBody = await c.req.text()
  const timestamp = c.req.header('X-Slack-Request-Timestamp') ?? ''
  const signature = c.req.header('X-Slack-Signature') ?? ''
  const secret = await getSlackSigningSecret()
  const valid = await verifySlackSignature(rawBody, timestamp, signature, secret)
  if (!valid) return c.json({ error: { code: 'FORBIDDEN', message: 'Invalid signature' } }, 403)

  const body = JSON.parse(rawBody)

  // url_verification: 即座に返す
  if (body.type === 'url_verification') {
    return c.json({ challenge: body.challenge })
  }

  // EventBridge 転送: 非同期で実行（Lambda がタイムアウトする前に完了を期待）
  const putPromise = ebClient.send(new PutEventsCommand({
    Entries: [{
      Source: 'saborou.webhook',
      DetailType: 'SlackEvent',
      Detail: JSON.stringify({ event: body.event, teamId: body.team_id }),
      EventBusName: process.env.EVENT_BUS_NAME,
    }]
  }))
  // Hono on Lambda は awaitしなくても Lambda runtime が putPromise を完了するまで待つ
  // （Lambda は非同期処理が完了するまでコンテナを維持する）
  await putPromise

  return c.json({ ok: true })
})
```

---

### パターン 8: esbuild 単一バンドル + ARM64

**問題**: Lambda コールドスタートを最小化し、コストを削減する。

**解決策**: 既存の esbuild ビルドスクリプトを拡張し、`pkgs/backend/dist` に 2 つのエントリポイントをバンドルする。

```json
// package.json scripts の更新案
{
  "build:api": "esbuild --bundle --outfile=dist/index.js --platform=node --target=node22 --format=esm src/handler.ts",
  "build:webhook": "esbuild --bundle --outfile=dist/webhook.js --platform=node --target=node22 --format=esm src/webhook-handler.ts",
  "build": "run-p build:api build:webhook"
}
```

**CDK での handler 設定**:
- API Lambda: `handler: 'index.handler'`
- Webhook Lambda: `handler: 'webhook.handler'`

両方とも `code: lambda.Code.fromAsset('../../pkgs/backend/dist')` から参照する（既存 CDK 設定を活用）。
