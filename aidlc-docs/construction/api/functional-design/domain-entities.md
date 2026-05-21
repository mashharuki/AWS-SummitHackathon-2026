# ドメインエンティティ定義 — U-04: api

**Unit**: U-04: api
**ステージ**: CONSTRUCTION / Functional Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. 概要

U-04 api は Hono on Lambda として動作する HTTP API レイヤーである。
ドメインエンティティは `@saboru/shared`（pkgs/shared）が唯一の真実の源として管理しており、
api レイヤーはそれらを HTTP レスポンスとして返却するか、入力を受け取ってリポジトリに委譲する。

本ドキュメントでは api レイヤー固有の入出力データ構造（Request DTO / Response DTO）を定義する。

---

## 2. リクエスト DTO

### 2.1 認証関連

#### POST /api/auth/exchange-token
```typescript
interface ExchangeTokenRequest {
  code: string;         // Cognito 認証コード
  redirectUri: string;  // OAuth コールバック URI
}

interface ExchangeTokenResponse {
  accessToken: string;
  idToken: string;
  expiresIn: number;    // 秒
}
```

---

### 2.2 タスク候補 / タスク関連

#### GET /api/tasks
- **クエリパラメータ**: `status?: 'pending' | 'approved'`
- **レスポンス**: `Task[] | TaskCandidate[]`（status により切り替え）

```typescript
// status=pending → TaskCandidate[]（pkgs/shared 型をそのまま返す）
// status=approved または省略 → Task[]（pkgs/shared 型をそのまま返す）
type GetTasksResponse = Task[] | TaskCandidate[];
```

#### GET /api/tasks/:id
```typescript
// Response: Task（pkgs/shared 型）
type GetTaskResponse = Task;
```

#### POST /api/tasks（手動追加）
```typescript
interface CreateTaskRequest {
  title: string;
  deadline?: string;       // ISO 8601 または null
  description?: string;
}
// Response: Task
type CreateTaskResponse = Task;
```

#### PATCH /api/tasks/:id（インライン編集）
```typescript
interface UpdateTaskRequest {
  title?: string;
  deadline?: string;
  description?: string;
}
// Response: Task
type UpdateTaskResponse = Task;
```

#### DELETE /api/tasks/:id（論理削除）
```typescript
// Response
interface DeleteTaskResponse {
  deleted: true;
}
```

#### POST /api/tasks/candidates/:id/approve（タスク候補承認）
```typescript
// Request body: なし
// Response: Task（status: 'approved'）
type ApproveTaskResponse = Task;
```

#### DELETE /api/tasks/candidates/:id（タスク候補削除）
```typescript
// Response
interface DeleteCandidateResponse {
  deleted: true;
}
```

---

### 2.3 提案関連

#### GET /api/tasks/:id/proposal
```typescript
// クエリパラメータ
interface GetProposalQuery {
  stream?: 'true';  // SSE ストリーミング有効化フラグ
}

// stream=false（デフォルト）レスポンス
type GetProposalResponse = Proposal;  // pkgs/shared 型

// stream=true レスポンス: SSE イベントストリーム
// Content-Type: text/event-stream
interface ProposalSSEDelta {
  type: 'delta';
  content: string;  // ストリーミングテキスト chunk
}
interface ProposalSSEVerdict {
  type: 'verdict';
  verdict: Verdict;  // pkgs/shared の Verdict 型
}
interface ProposalSSEDone {
  type: 'done';
  proposalId: string;
}
type ProposalSSEEvent = ProposalSSEDelta | ProposalSSEVerdict | ProposalSSEDone;
```

---

### 2.4 本音データ関連

#### POST /api/tasks/:id/honne
```typescript
interface RecordHonneRequest {
  type: 'quick_reply' | 'free_text';
  content: string;   // クイック返信ID または自由入力テキスト
}

interface RecordHonneResponse {
  saved: true;
  reply: string;       // サボローの返答メッセージ（固定文言）
  visionText: string;  // 「将来の取扱説明書になります」テキスト
}
```

---

### 2.5 連携設定関連

#### GET /api/connections
```typescript
// Response
type GetConnectionsResponse = ServiceConnection[];  // pkgs/shared 型
```

#### POST /api/connections/slack/callback
```typescript
interface SlackCallbackRequest {
  code: string;   // Slack OAuth 認証コード
  state: string;  // CSRF 防止ステート
}
// Response: ServiceConnection
type SlackCallbackResponse = ServiceConnection;
```

#### DELETE /api/connections/:service
```typescript
// Response
interface DisconnectResponse {
  disconnected: true;
}
```

---

### 2.6 Webhook 関連（BE-06）

#### POST /webhooks/slack
```typescript
// Slack Events API ペイロード（署名検証後）
interface SlackWebhookRequest {
  type: 'url_verification' | 'event_callback';
  challenge?: string;  // url_verification 時
  event?: {
    type: string;
    user: string;
    text: string;
    ts: string;
    channel: string;
  };
  team_id?: string;
}

// レスポンス
interface SlackWebhookResponse {
  challenge?: string;  // url_verification 時のみ
}
```

---

## 3. エラーレスポンス統一形式

```typescript
interface ApiError {
  error: {
    code: string;    // 機械可読エラーコード
    message: string; // 人間可読メッセージ
    details?: unknown;
  };
}
```

### エラーコード一覧

| HTTP Status | code | 説明 |
|------------|------|------|
| 400 | VALIDATION_ERROR | リクエストボディ・クエリパラメータのバリデーション失敗 |
| 401 | UNAUTHORIZED | JWT トークン欠如・無効 |
| 403 | FORBIDDEN | 他ユーザーリソースへのアクセス試行 |
| 404 | NOT_FOUND | リソースが存在しない |
| 409 | CONFLICT | 既存リソースとの競合（重複承認等） |
| 500 | INTERNAL_ERROR | サーバー内部エラー（詳細はログのみ） |
| 503 | SERVICE_UNAVAILABLE | DynamoDB・Bedrock 一時的障害 |

---

## 4. 認証コンテキスト

Cognito JWT Authorizer（API Gateway レベル）が検証済みの userId を Lambda イベントに注入する。
Hono ミドルウェアがイベントコンテキストから userId を抽出し、`c.set('userId', userId)` でルートハンドラに渡す。

```typescript
// Hono Variables 型定義
type HonoVariables = {
  userId: string;  // Cognito sub（UUID）
};

type AppEnv = {
  Variables: HonoVariables;
};
```
