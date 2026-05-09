# コンポーネントメソッド定義 — SABOROU

**プロジェクト名**: SABOROU（サボロー）
**作成日**: 2026-05-09
**バージョン**: 1.0.0
**注意**: 詳細なビジネスロジックは Construction フェーズの Functional Design で定義する

---

## 1. バックエンド API メソッド（apps/api）

### BE-01: AuthHandler

```typescript
// Hono ミドルウェア: JWT 検証
authMiddleware(c: Context, next: Next): Promise<void>
// Returns: userId を c.set('userId', userId) で注入

// トークン交換（Cognito code → JWT）
POST /api/auth/exchange-token
Request:  { code: string, redirectUri: string }
Response: { accessToken: string, idToken: string, expiresIn: number }
```

### BE-02: TaskHandler

```typescript
// タスク一覧取得（候補 + 承認済み）
GET /api/tasks
Query:    { status?: 'pending' | 'approved' }
Response: Task[]

// タスク取得（単一）
GET /api/tasks/:id
Response: Task

// 手動タスク追加
POST /api/tasks
Request:  { title: string, deadline?: string, description?: string }
Response: Task

// タスク更新（インライン編集）
PATCH /api/tasks/:id
Request:  Partial<{ title: string, deadline: string, description: string }>
Response: Task

// タスク削除
DELETE /api/tasks/:id
Response: { deleted: true }

// タスク候補承認（pending → approved）
POST /api/tasks/candidates/:id/approve
Response: Task  // status: 'approved'
```

### BE-03: ProposalHandler

```typescript
// サボり提案取得（オンデマンド再評価含む）
GET /api/tasks/:id/proposal
Query:    { stream?: boolean }
Response: Proposal | SSE stream of Proposal delta
```

### BE-04: HonneHandler

```typescript
// 本音データ記録
POST /api/tasks/:id/honne
Request:  {
  type: 'quick_reply' | 'free_text',
  content: string,    // クイック返信ID or 自由入力テキスト
}
Response: {
  saved: true,
  reply: string,      // サボローの返答メッセージ
  visionText: string  // 「将来の取扱説明書になります」テキスト
}
```

### BE-05: ConnectionHandler

```typescript
// 連携状態一覧
GET /api/connections
Response: ServiceConnection[]

// Slack OAuth コールバック処理
POST /api/connections/slack/callback
Request:  { code: string, state: string }
Response: ServiceConnection

// Google OAuth コールバック処理（Gmail + Calendar スコープ）
POST /api/connections/google/callback
Request:  { code: string, state: string, scopes: string[] }
Response: ServiceConnection

// 連携解除
DELETE /api/connections/:service
Response: { disconnected: true }
```

### BE-06: WebhookHandler

```typescript
// Slack Events API Webhook 受信
POST /webhooks/slack
Request:  SlackEvent  // Slack Events API payload
Response: { challenge?: string }  // URL Verification 対応
// Side effect: EventBridge にイベントを転送
```

---

## 2. エージェントコンポーネントメソッド（packages/agent）

### AG-01: TaskExtractorAgent

```typescript
interface ITaskExtractorAgent {
  extractTask(input: ExternalEvent): Promise<TaskCandidate>
}

// ExternalEvent の種別
type ExternalEvent =
  | { source: 'slack'; message: SlackMessage }
  | { source: 'gmail'; email: GmailMessage }
  | { source: 'calendar'; event: CalendarEvent }

// 抽出結果
interface TaskCandidate {
  title: string
  deadline?: string
  requester?: string
  description?: string
  sourceType: 'slack' | 'gmail' | 'calendar'
  sourceRef: string  // 元メッセージの参照ID（生データは保存しない）
}
```

### AG-02: SaboriProposerAgent

```typescript
interface ISaboriProposerAgent {
  propose(taskId: string, context: TaskContext): Promise<Proposal>
}

// タスクコンテキスト
interface TaskContext {
  task: Task
  slackContext?: SlackContext
  gmailContext?: GmailContext
  calendarContext?: CalendarContext
}

// 提案結果
interface Proposal {
  taskId: string
  verdict: Verdict  // 'can_saboru' | 'caution' | 'danger'
  summaryText: string  // 1行サマリ（タスク一覧用）
  reasoning: string[]  // 判断材料の箇条書きリスト
  chatMessage: string  // サボローのチャットメッセージ（persona 適用済み）
  evaluatedAt: string  // ISO 8601
  nextCheckAt: string  // 次回再評価タイミング ISO 8601
}
```

### AG-03: PersonaRenderer

```typescript
render(params: {
  verdict: Verdict,
  reasoning: string[],
  summaryText: string,
  personaId: string  // 'saboru_ottori'
}): Promise<{
  chatMessage: string,
  summaryText: string  // persona に合わせた1行サマリ
}>
```

### AG-04: ContextCollector

```typescript
collectSlackContext(params: {
  taskId: string,
  userId: string,
  sourceRef?: string
}): Promise<SlackContext>

collectGmailContext(params: {
  taskId: string,
  userId: string,
  sourceRef?: string
}): Promise<GmailContext>

collectCalendarContext(params: {
  taskId: string,
  userId: string
}): Promise<CalendarContext>

// コンテキスト型定義
interface SlackContext {
  hasReminder: boolean
  reminderCount: number
  requesterStatus: 'online' | 'away' | 'offline' | 'unknown'
  urgencyLevel: 'low' | 'medium' | 'high'  // メッセージ文言から推定
  lastMessageAt?: string
}

interface GmailContext {
  hasUrgentKeyword: boolean  // 「急ぎ」「ASAP」等の検出
  lastEmailAt?: string
  emailCount: number
}

interface CalendarContext {
  relatedMeetings: Array<{
    title: string
    startAt: string
    minutesUntilMeeting: number
  }>
  nearestDeadline?: string
}
```

---

## 3. 共有パッケージメソッド（packages/shared）

```typescript
// 日付ユーティリティ
formatDeadline(isoDate: string): string  // 「明日 14:00」などの人間向け表現
minutesUntil(isoDate: string): number
isOverdue(isoDate: string): boolean

// Bedrockトークンカウンタ（8,000トークン制限ガード）
countTokens(text: string): number
guardTokenLimit(prompt: string, limit?: number): string  // 超過時にトリム

// エラーハンドリング
class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public statusCode: number
  ) {}
}

type ErrorCode =
  | 'TASK_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'EXTERNAL_API_FAILED'
  | 'BEDROCK_TIMEOUT'
  | 'BEDROCK_COST_EXCEEDED'
  | 'DYNAMO_WRITE_FAILED'
```

---

## 4. インフラコンポーネントメソッド（infra/）

```typescript
// CognitoStack の主要設定
class CognitoStack extends cdk.Stack {
  userPool: cognito.UserPool
  userPoolClient: cognito.UserPoolClient
  userPoolDomain: cognito.UserPoolDomain
}

// DataStack の主要エクスポート
class DataStack extends cdk.Stack {
  tasksTable: dynamodb.Table
  proposalsTable: dynamodb.Table
  honneDataTable: dynamodb.Table
  usersTable: dynamodb.Table
  connectionsTable: dynamodb.Table
  personasTable: dynamodb.Table
}

// ApiStack の主要設定
class ApiStack extends cdk.Stack {
  httpApi: apigateway.HttpApi
  honoFunction: lambda.Function
}
```
