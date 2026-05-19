# ビジネスロジックモデル — U-05: web

**Unit**: U-05: web
**ステージ**: CONSTRUCTION / Functional Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. コアロジックフロー

### 1.1 認証フロー

```
[LoginPage]
  ↓ Google でログイン クリック
[AuthProvider.signIn()]
  → state生成・localStorage保存
  → Cognito Hosted UI へリダイレクト
  ↓ Google OAuth 完了 → /auth/callback
[LoginPage + AuthProvider]
  → state検証
  → Cognito Authorization Code Exchange
  → JWT (accessToken, idToken, refreshToken) 取得
  → メモリ保持（accessToken）+ localStorage（refreshToken）
  → /tasks へリダイレクト
```

### 1.2 タスク一覧ロード・表示フロー

```
[TaskListPage mount]
  → Promise.all([
      GET /api/tasks?status=pending   → candidates[]
      GET /api/tasks?status=approved  → tasks[]
    ])
  → proposals: tasks.map(t => GET /api/tasks/:t.id/proposal) の並列取得
  → state.tasks / state.candidates / state.proposals 更新
  → バナーメッセージ判定（BR-WEB-07）
  → TaskCard リスト描画
```

### 1.3 タスク承認フロー

```
[TaskCard.onApprove()]
  → 楽観的更新: candidates から対象を除去、tasks に追加（state更新）
  → POST /api/tasks/candidates/:id/approve
  成功: tasks リスト再取得（または楽観的更新継続）
  失敗: 楽観的更新をロールバック → エラートースト表示
```

### 1.4 タスク詳細 + SSEストリーミングフロー

```
[TaskDetailPage mount]
  → GET /api/tasks/:id（タスク情報取得）
  → GET /api/tasks/:id/proposal?stream=true（SSE開始）
    EventSource onmessage:
      chunk受信 → chatMessages の最後のメッセージに append
    EventSource onopen:
      chatMessages に { role: 'saboru', content: '', isStreaming: true } 追加
    EventSource onclose / error:
      isStreaming: false に更新
      proposal.verdict が確定 → 左ペイン判定ボックス更新
      Three.js verdict アニメーション切り替え
```

### 1.5 本音記録フロー

```
[クイック返信 or 自由テキスト送信]
  → POST /api/tasks/:id/honne { type, content }
  成功:
    → chatMessages にユーザーメッセージ追加
    → APIレスポンスの reply を chatMessages に追加（role: 'saboru'）
    → 「取扱説明書になります」テキスト表示
  失敗:
    → エラートースト表示
```

### 1.6 Slack 連携フロー

```
[SettingsPage: Slack連携ボタン]
  → GET /api/connections/slack/auth-url
  → Slack OAuth ページへリダイレクト
  ↓ Slack OAuth 完了 → /auth/slack/callback?code=...
[SettingsPage（コールバック受信）]
  → POST /api/connections/slack/callback { code }
  → GET /api/connections で連携状態再取得
  → 「連携済み」バッジ表示
```

---

## 2. コンポーネント階層

```
App（ルーティング）
├── AuthProvider（認証コンテキスト）
│   └── AppShell（レイアウト・認証ガード）
│       ├── /login → LoginPage
│       ├── /auth/callback → AuthCallbackPage
│       ├── /tasks → TaskListPage
│       │   └── TaskCard[]
│       │       └── TaskEditForm（インライン）
│       │   └── TaskAddModal
│       ├── /tasks/:id → TaskDetailPage
│       │   ├── TaskInfoPane（左ペイン）
│       │   │   ├── VerdictBox（判定ボックス）
│       │   │   └── EvidenceList（根拠リスト）
│       │   └── ChatPane（右ペイン）
│       │       ├── ChatMessageList
│       │       ├── SaborouCharacter（Three.js）
│       │       ├── QuickReplyButtons
│       │       └── FreeTextInput
│       └── /settings → SettingsPage
│           ├── UserProfileCard
│           ├── ServiceConnectionList
│           └── PersonaDisplay
```

---

## 3. 状態管理方針

### 3.1 状態の種類と管理場所

| 状態 | 管理場所 | 理由 |
|------|---------|------|
| 認証状態（user, token） | AuthProvider Context | アプリ全体から参照 |
| タスク一覧 | TaskListPage ローカル state | ページ限定 |
| タスク詳細・提案 | TaskDetailPage ローカル state | ページ限定 |
| チャットメッセージ | TaskDetailPage ローカル state | SSEストリーミングと連動 |
| トースト通知 | AppShell Context（or ローカル） | ページをまたぐ |
| 連携状態 | SettingsPage ローカル state | ページ限定 |

**方針**: React 19 の useState / useContext / useReducer を活用。外部状態管理ライブラリ（Zustand / Redux）は導入しない（MVPスコープでは不要）。

### 3.2 カスタムフック設計

```typescript
// 認証
useAuth(): AuthContext

// タスク操作
useTasks(): {
  tasks: Task[];
  candidates: TaskCandidate[];
  isLoading: boolean;
  approveCandidate: (id: string) => Promise<void>;
  deleteCandidate: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTask: (id: string, data: UpdateTaskRequest) => Promise<void>;
  createTask: (data: CreateTaskRequest) => Promise<void>;
  refetch: () => Promise<void>;
}

// SSEストリーミング（Vercel AI SDK useChat フック）
useProposalStream(taskId: string): {
  messages: ChatMessage[];
  isStreaming: boolean;
  sendMessage: (content: string, type?: QuickReplyType) => Promise<void>;
  proposal: Proposal | null;
}

// 連携設定
useConnections(): {
  connections: ServiceConnection[];
  isLoading: boolean;
  connectSlack: () => void;
  disconnect: (service: ServiceType) => Promise<void>;
  refetch: () => Promise<void>;
}

// トースト通知
useToast(): {
  toast: ToastMessage | null;
  showToast: (message: string, type: ToastMessage['type']) => void;
  clearToast: () => void;
}
```

---

## 4. APIクライアント設計

### 4.1 ベース設定

```typescript
// Bearer Token 自動付与
// 401時の自動リフレッシュ
// エラー統一ハンドリング
// TypeScript 型付き (pkgs/shared 型を利用)
```

### 4.2 SSEストリーミング実装方針

```
Vercel AI SDK の useChat フックを使用する

// useChat の接続先: GET /api/tasks/:id/proposal?stream=true
// EventSource / ReadableStream を抽象化してチャット UI に接続
// サボロー応答テキストをチャンク単位で messages state に追加
```

---

## 5. Three.js 演出設計

### 5.1 使用ライブラリ

- `@react-three/fiber` v9（React Three Fiber）
- `@react-three/drei` v10（便利コンポーネント群）

### 5.2 キャラクター実装方針

- サボローのキャラクターを抽象的な3Dオブジェクト（球体 or 丸いキューブ）で表現
- verdict 別のアニメーション:
  - `can_saboru`: ゆっくり上下浮遊（Float アニメーション）
  - `caution`: 左右ゆらゆら（Pulse）
  - `danger`: 小刻みに震える（Shake）
  - idle/streaming: ゆっくり回転（Rotate）
- `<Canvas>` はチャット右ペイン上部の固定エリア（200x200px）に配置
- `prefers-reduced-motion` が設定された環境では静止の絵文字フォールバック（"☁️"）を使用

### 5.3 パフォーマンス考慮

- `Suspense` でロードを遅延
- `useFrame` で毎フレームのアニメーション更新
- Canvas サイズは固定（動的リサイズなし）でパフォーマンス安定化
