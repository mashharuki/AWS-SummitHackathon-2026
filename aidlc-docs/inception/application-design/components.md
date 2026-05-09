# コンポーネント定義 — SABOROU

**プロジェクト名**: SABOROU（サボロー）
**作成日**: 2026-05-09
**バージョン**: 1.0.0
**対応ステージ**: Application Design（Comprehensive 深度）

---

## 1. フロントエンドコンポーネント（apps/web）

### FE-01: TaskListPage（タスク一覧ページ）

**責務**:
- タスク候補（pending）と承認済みタスク（approved）を2セクションに分けて表示する
- タスク候補セクションで承認・編集・削除アクションを処理する
- 1行サボり判定サマリをタスクカードに表示する
- フローティングアクションボタン（+）で手動タスク追加フォームを開く

**インタフェース**:
- 入力: `Task[]`（候補・承認済みの両方）、`Proposal[]`（承認済みタスクの最新判定）
- イベント: `onApprove(taskId)` / `onEdit(taskId, updates)` / `onDelete(taskId)` / `onManualAdd(taskData)`

**依存コンポーネント**:
- TaskCard（FE-08）
- APIClient（FE-07）

---

### FE-02: TaskDetailPage（タスク詳細・チャットページ）

**責務**:
- 左ペイン: タスクの前提情報・サボり判定ボックス（3状態色分け）・判断材料の表示
- 右ペイン: サボローのチャット履歴・クイック返信4ボタン・自由入力欄
- オンデマンドでサボり提案を再評価しストリーミング表示する
- 本音データ（クイック返信・自由入力）を記録する

**インタフェース**:
- 入力: `taskId: string`（URLパラメータ）
- 依存データ: `Task`・`Proposal`・`HonneData[]`
- イベント: `onQuickReply(type: QuickReplyType)` / `onFreeTextSubmit(text: string)` / `onProposalRefresh()`

**依存コンポーネント**:
- APIClient（FE-07）
- AuthProvider（FE-06）

---

### FE-03: LoginPage（ログインページ）

**責務**:
- Google ソーシャルログインボタンを表示する
- Cognito Hosted UI へのリダイレクトを開始する
- OAuth コールバック時に Cognito トークンを受け取り、セッションを確立する

**インタフェース**:
- 入力: OAuth コールバックパラメータ（`code`, `state`）
- 出力: Cognito JWT セッション確立 → タスク一覧画面にリダイレクト

**依存コンポーネント**:
- AuthProvider（FE-06）

---

### FE-04: SettingsPage（連携設定ページ）

**責務**:
- Slack / Gmail / Google Calendar の連携状態（連携済み / 未連携）を表示する
- 各サービスの OAuth 接続フローを開始する
- OAuth トークン再連携を促すバナーを表示する（トークン期限切れ時）

**インタフェース**:
- 入力: `ServiceConnection[]`（連携状態）
- イベント: `onConnectSlack()` / `onConnectGoogle(scope)` / `onDisconnect(service)`

**依存コンポーネント**:
- APIClient（FE-07）
- AuthProvider（FE-06）

---

### FE-05: AppShell（アプリケーションシェル）

**責務**:
- ヘッダー（ユーザーアイコン・ログアウトボタン）・ナビゲーションを提供する
- 認証ガード（未認証時は LoginPage にリダイレクト）を実装する
- グローバルトースト通知を管理する

**インタフェース**:
- 入力: 子コンポーネント（pages）
- 出力: グローバルレイアウト・認証状態の注入

**依存コンポーネント**:
- AuthProvider（FE-06）

---

### FE-06: AuthProvider（認証プロバイダ）

**責務**:
- Cognito JWT の取得・更新・保持を管理する
- 認証状態（isAuthenticated, user）をコンテキスト経由で全コンポーネントに提供する
- API リクエスト時に Authorization ヘッダーを自動付与する

**インタフェース**:
- 提供コンテキスト: `{ user: User | null, isAuthenticated: boolean, signOut: () => void }`
- 依存: Amazon Cognito SDK（`amazon-cognito-identity-js`）

---

### FE-07: APIClient（APIクライアント）

**責務**:
- バックエンド REST API への全リクエストを集約する
- JWT トークンの自動付与・リフレッシュを処理する
- ネットワークエラー・HTTP エラーの統一ハンドリングを提供する
- 型安全なリクエスト/レスポンス定義（`packages/shared` の型を使用）を保証する

**インタフェース**:
- メソッド: `getTasks()` / `approveTask(id)` / `deleteTask(id)` / `updateTask(id, data)` / `getProposal(taskId)` / `recordHonne(taskId, data)` / `getConnections()` / `connectService(service)`
- 依存: `packages/shared`（型定義）

---

### FE-08: TaskCard（タスクカード）

**責務**:
- 単一タスクのカード表示（タスク名・締切・依頼者）を担う
- pending 状態では承認/編集/削除ボタンを表示する
- approved 状態では1行サボり判定サマリを表示する
- インライン編集モードへの切り替えを処理する

**インタフェース**:
- Props: `task: Task`, `proposal?: Proposal`, `mode: 'pending' | 'approved'`
- イベント: `onApprove()` / `onEdit(updates)` / `onDelete()` / `onClick()`

---

## 2. バックエンド API コンポーネント（apps/api）

### BE-01: AuthHandler（認証ハンドラ）

**責務**:
- Cognito JWT の検証・ユーザー情報の取得を行う
- Hono ミドルウェアとして全ルートに認証ガードを提供する
- 初回ログイン時に Users テーブルにユーザーレコードを作成する

**インタフェース**:
- Hono Middleware: `authMiddleware`（リクエストコンテキストに `userId` を注入）
- エンドポイント: `POST /api/auth/exchange-token`

**依存サービス**:
- Amazon Cognito（JWT 検証）
- DynamoDB（Users テーブル）

---

### BE-02: TaskHandler（タスク CRUD ハンドラ）

**責務**:
- タスク候補・承認済みタスクの CRUD 操作を処理する
- `POST /api/tasks/candidates/:id/approve` で pending → approved 遷移を行う
- 手動タスク追加（`POST /api/tasks`）を処理する
- タスク一覧の取得（`GET /api/tasks`）でサボり判定サマリを含む

**インタフェース**:
- `GET /api/tasks` → `Task[]`
- `POST /api/tasks` → `Task`
- `GET /api/tasks/:id` → `Task`
- `PATCH /api/tasks/:id` → `Task`
- `DELETE /api/tasks/:id` → `void`
- `POST /api/tasks/candidates/:id/approve` → `Task`

**依存サービス**:
- DynamoDB（Tasks テーブル）
- `packages/shared`（型定義）

---

### BE-03: ProposalHandler（サボり提案ハンドラ）

**責務**:
- `GET /api/tasks/:id/proposal` でオンデマンドのサボり提案取得・再評価トリガーを処理する
- 最新の提案を DynamoDB から返す（新規評価が必要な場合はエージェントを非同期起動）
- Bedrock のレスポンスをストリーミングで返す（Server-Sent Events）

**インタフェース**:
- `GET /api/tasks/:id/proposal` → `Proposal`（またはSSEストリーム）

**依存コンポーネント**:
- `packages/agent`（SaboriProposerAgent）
- DynamoDB（Proposals テーブル）

---

### BE-04: HonneHandler（本音データハンドラ）

**責務**:
- クイック返信・自由入力の本音データを受け取り DynamoDB に保存する
- 本音データ保存後にサボローの返答メッセージを生成して返す

**インタフェース**:
- `POST /api/tasks/:id/honne` → `{ saved: true, reply: string }`

**依存サービス**:
- DynamoDB（HonneData テーブル）
- `packages/agent`（PersonaRenderer）

---

### BE-05: ConnectionHandler（外部サービス連携ハンドラ）

**責務**:
- 外部サービス（Slack / Gmail / Google Calendar）の OAuth トークンを管理する
- Slack OAuth コールバック処理・トークン保存を行う
- Google OAuth スコープ拡張フローを処理する
- 連携状態一覧を返す

**インタフェース**:
- `GET /api/connections` → `ServiceConnection[]`
- `POST /api/connections/slack/callback` → `ServiceConnection`
- `POST /api/connections/google/callback` → `ServiceConnection`
- `DELETE /api/connections/:service` → `void`

**依存サービス**:
- AWS Secrets Manager（OAuth トークン保管）
- DynamoDB（ServiceConnections テーブル）

---

### BE-06: WebhookHandler（Webhook 受信ハンドラ）

**責務**:
- Slack Events API からの Webhook を受信・検証する
- Slack の URL Verification チャレンジに応答する
- Webhook イベントを EventBridge に転送してバックグラウンド処理に引き渡す

**インタフェース**:
- `POST /webhooks/slack` → `{ challenge?: string }`（Slack URL Verification 対応）

**依存サービス**:
- Amazon EventBridge（イベント転送）
- AWS Secrets Manager（Slack Signing Secret 検証）

---

## 3. エージェントコンポーネント（packages/agent）

### AG-01: TaskExtractorAgent（タスク抽出エージェント）

**責務**:
- 外部メッセージ（Slack / Gmail / Google Calendar イベント）を受け取り、構造化タスク候補に変換する
- Bedrock AgentCore を使用して自然言語からタスク属性（名前・締切・依頼者・作業内容）を抽出する
- 抽出結果を DynamoDB TaskCandidates テーブルに書き込む

**インタフェース**:
- `extractTask(input: ExternalEvent): Promise<TaskCandidate>`
- `ITaskExtractorAgent` インタフェースを実装（将来の差し替えに備え抽象化）

**依存サービス**:
- Amazon Bedrock AgentCore（Claude Sonnet）
- DynamoDB（TaskCandidates テーブル）

---

### AG-02: SaboriProposerAgent（サボり提案エージェント）

**責務**:
- 承認済みタスクと周辺文脈（Slack温度感・Gmail・Google Calendar）を統合してサボり判定（3状態）を生成する
- `can_saboru` / `caution` / `danger` の verdict を決定する
- PersonaRenderer を呼び出しておっとりサボローの口調で提案文を生成する
- 次回再評価タイミング（next_check_at）を計算する

**インタフェース**:
- `propose(taskId: string, context: TaskContext): Promise<Proposal>`
- `ISaboriProposerAgent` インタフェースを実装

**依存コンポーネント**:
- ContextCollector（AG-04）
- PersonaRenderer（AG-03）
- Amazon Bedrock AgentCore（Claude Sonnet）
- DynamoDB（Proposals テーブル）

---

### AG-03: PersonaRenderer（ペルソナレンダラ）

**責務**:
- サボり判定結果（verdict / reasoning）をペルソナテンプレートに従って口調変換する
- DynamoDB Personas テーブルからペルソナ定義（prompt_template / tone / emojis）を取得する
- MVP では `saboru_ottori`（おっとりサボロー）固定。将来の複数人格化に対応した設計

**インタフェース**:
- `render(verdict: Verdict, reasoning: string[], personaId: string): Promise<string>`

**依存サービス**:
- DynamoDB（Personas テーブル）

---

### AG-04: ContextCollector（文脈収集ツール）

**責務**:
- 指定タスクに関連する外部ツールの文脈情報を収集する
- Slack: 関連スレッドのリマインド有無・依頼者のオンライン状態・温度感を取得する
- Gmail: 関連メールの本文要約・「急ぎ」フラグを取得する
- Google Calendar: 関連会議の日時・次の締切イベントを取得する
- 取得した生データは処理後即削除（NFR-07 準拠）

**インタフェース**:
- `collectSlackContext(taskId: string): Promise<SlackContext>`
- `collectGmailContext(taskId: string): Promise<GmailContext>`
- `collectCalendarContext(taskId: string): Promise<CalendarContext>`

**依存サービス**:
- AWS Secrets Manager（OAuth トークン取得）
- Slack API / Gmail API / Google Calendar API

---

## 4. 共有パッケージコンポーネント（packages/shared）

### SH-01: 型定義モジュール

**責務**:
- フロントエンド・バックエンド・エージェント間で共有される型定義を一元管理する
- `Task` / `Proposal` / `HonneData` / `User` / `ServiceConnection` / `Persona` / `Verdict` 等の型を定義する

**主要型**:
- `TaskStatus`: `'pending' | 'approved' | 'deleted'`
- `Verdict`: `'can_saboru' | 'caution' | 'danger'`
- `QuickReplyType`: `'keep_sleeping' | 'do_it_early' | 'do_15min' | 'full_ignore'`
- `ServiceType`: `'slack' | 'gmail' | 'google_calendar'`

---

### SH-02: 共通ユーティリティモジュール

**責務**:
- 日付・時刻のフォーマット・計算ユーティリティを提供する
- トークンカウンタ（Bedrock 8,000トークン制限ガード）を提供する
- エラーコード定義・エラーハンドリングヘルパーを提供する

---

## 5. インフラコンポーネント（infra/）

### INF-01: CognitoStack

- Cognito User Pool + Google ソーシャルログイン設定
- Hosted UI + OAuth 2.0 フロー設定

### INF-02: DataStack

- DynamoDB 全テーブル定義（Users / ServiceConnections / TaskCandidates / Tasks / Proposals / HonneData / Personas）
- GSI 設定・TTL 設定

### INF-03: ApiStack

- API Gateway HTTP API + Lambda（Hono）統合
- CORS 設定・JWT オーソライザー設定

### INF-04: AgentStack

- Bedrock AgentCore 設定
- Lambda（TaskExtractorAgent / SaboriProposerAgent）IAM ロール設定
- Bedrock モデル呼び出し権限

### INF-05: FrontendStack

- S3 バケット（React ビルド成果物ホスティング）
- CloudFront ディストリビューション設定
- OAC（Origin Access Control）設定

### INF-06: WebhookStack

- Webhook 受信用 Lambda（独立エンドポイント）
- EventBridge Custom Event Bus
- EventBridge ルール（Slack / Gmail / Calendar イベント振り分け）
