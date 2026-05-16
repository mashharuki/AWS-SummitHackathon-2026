# コンポーネント定義 — SABOROU

**プロジェクト名**: SABOROU（サボロー）
**作成日**: 2026-05-09
**バージョン**: 1.1.0
**更新日**: 2026-05-10（AG-05: TaskOrganizerAgent 追加 / PersonaRenderer に人格A/B定義追加）
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
- Slack の連携状態（連携済み / 未連携）を表示する（v1.1.0 以降: Gmail / Google Calendar 追加予定）
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
- 外部サービス（Slack）の OAuth トークンを管理する（v1.0.0 は Slack のみ）
- Slack OAuth コールバック処理・トークン保存を行う
- 連携状態一覧を返す

> v1.1.0 以降で Google OAuth（Gmail / Calendar スコープ）を追加予定。
> `POST /api/connections/google/callback` は v1.1.0 実装対象。

**インタフェース**:
- `GET /api/connections` → `ServiceConnection[]`
- `POST /api/connections/slack/callback` → `ServiceConnection`
- `DELETE /api/connections/:service` → `{ disconnected: true }`

**依存サービス**:
- AWS Secrets Manager（OAuth トークン保管）
- DynamoDB（ServiceConnections テーブル）

---

### BE-06: WebhookHandler（Webhook 受信ハンドラ）

**責務**:
- Slack Events API からの Webhook を受信・検証する
- Slack の URL Verification チャレンジに応答する
- `@slack/bolt` を用いてイベントを正規化し、EventBridge に転送してバックグラウンド処理に引き渡す

**インタフェース**:
- `POST /webhooks/slack` → `{ challenge?: string }`（Slack URL Verification 対応）

**依存サービス**:
- `@slack/bolt`（Slack SDK） - Webhook 受信・署名検証・URL Verification
- Amazon EventBridge（イベント転送）
- AWS Secrets Manager（Slack Signing Secret 検証）

**技術実装詳細**:
- `@slack/bolt` の `App` クラスを使用し、Webhook 受信と署名検証を標準化する
- `bolt.action` / `bolt.event` で URL Verification チャレンジとイベント正規化を処理する
- 正規化後のイベントを EventBridge に PutEvents して非同期処理へ受け渡す
- ※ Vercel AI SDK（`ai` npm package）はフロントエンドの useChat フック（FE-02）でのみ使用する

---

## 3. エージェントコンポーネント（packages/agent）

### AG-01: TaskExtractorAgent（タスク抽出エージェント）

**責務**:
- 外部メッセージ（Slack イベント）を受け取り、構造化タスク候補に変換する
- Amazon Bedrock（converse API + Tool Use）を使用して自然言語からタスク属性（名前・締切・依頼者・作業内容）を抽出する
- 抽出結果を DynamoDB TaskCandidates テーブルに書き込む

> v1.1.0 以降で Gmail / Google Calendar イベントの対応を追加予定。

**インタフェース**:
- `extractTask(input: ExternalEvent): Promise<TaskCandidate>`
- `ITaskExtractorAgent` インタフェースを実装（将来の差し替えに備え抽象化）

**依存サービス**:
- Amazon Bedrock（converse API + Tool Use）（Claude Sonnet）
- DynamoDB（TaskCandidates テーブル）

---

### AG-05: TaskOrganizerAgent（タスク整理エージェント）★新規追加（v1.1.0）

> **★ v1.1.0 scope — MVP（v1.0.0）では実行されない**。予選スコープ外。決勝（M3: 2026-06-26）向け実装対象。

**Unit**: U-03c: task-organizer

**責務**:
- TaskExtractorAgent（AG-01）が収集した生タスクリストを受け取り、依存関係・手順・優先順位を整理・構造化する
- Bedrock converse API + Tool Use を使用してタスク間の論理的依存関係を分析する（「タスクAが完了しないとタスクBが開始できない」等）
- 「どの順番でタスクを処理すれば最も長くサボれるか」を計算する最適化ロジックを提供する
- 各タスクに「サボり余地スコア（0〜100）」を付与し、SaboriProposerAgent に構造化データとして引き渡す
- 整理結果を DynamoDB TaskOrganization テーブルに書き込む

**インタフェース**:
- `organizeTask(taskCandidates: TaskCandidate[]): Promise<OrganizedTaskPlan>`
- `ITaskOrganizerAgent` インタフェースを実装（将来の差し替えに備え抽象化）

**OrganizedTaskPlan の構造**:
```typescript
interface OrganizedTaskPlan {
  taskId: string;
  dependsOn: string[];        // 依存タスクIDリスト
  recommendedOrder: number;   // 実行推奨順序（1が最優先）
  saboruMarginScore: number;  // サボり余地スコア（0: 即着手必須 / 100: 完全に寝かせてOK）
  parallelTasks: string[];    // 並行実行可能なタスクIDリスト
  reasoningForOrder: string;  // 順序付けの根拠（Bedrock が生成）
}
```

**依存サービス**:
- Amazon Bedrock（converse API + Tool Use）（Claude Sonnet）— 依存関係分析・最適化計算
- DynamoDB（TaskCandidates テーブル — 参照）
- DynamoDB（TaskOrganization テーブル — 書き込み）

**パイプライン上の位置**:
```
TaskExtractorAgent（AG-01）→ TaskOrganizerAgent（AG-05）→ SaboriProposerAgent（AG-02）
```

---

### AG-02: SaboriProposerAgent（サボり提案エージェント）

**責務**:
- 承認済みタスクと Slack 文脈（ContextCollector）を統合してサボり判定（3状態）を生成する
- `can_saboru` / `caution` / `danger` の verdict を決定する
- v1.1.0 以降では TaskOrganizerAgent（AG-05）のサボり余地スコアを参考情報として入力プロンプトに含める（判定精度向上）
- PersonaRenderer を呼び出し、選択された人格（人格A: おっとり / 人格B: 熱血）の口調で提案文を生成する
- 次回再評価タイミング（next_check_at）を計算する

**インタフェース**:
- `propose(taskId: string, context: TaskContext, organizedPlan?: OrganizedTaskPlan): Promise<Proposal>`
- `ISaboriProposerAgent` インタフェースを実装

**依存コンポーネント**:
- ContextCollector（AG-04）
- PersonaRenderer（AG-03）— 人格A/B 対応
- Amazon Bedrock（converse API + Tool Use）（Claude Sonnet）
- DynamoDB（Proposals テーブル）

> v1.1.0 以降で TaskOrganizerAgent（AG-05）との連携を追加予定（`organizedPlan` は任意入力）。

---

### AG-03: PersonaRenderer（ペルソナレンダラ）

**責務**:
- サボり判定結果（verdict / reasoning）をペルソナテンプレートに従って口調変換する
- DynamoDB Personas テーブルからペルソナ定義（prompt_template / tone / emojis）を取得する
- MVP では `saboru_ottori`（人格A: おっとりサボロー）固定。将来展望では `saboru_nekkyou`（人格B: 熱血サボロー）との A/B テストに対応

**サポートする人格**:

| persona_id | 人格名 | コンセプト | MVP適用 |
|-----------|--------|-----------|---------|
| `saboru_ottori` | おっとりサボロー（人格A） | 「心の余白・良化を求める存在」。穏やかで共感的。メンタルウェルネスの観点からサボりを正当化 | MVP固定 |
| `saboru_nekkyou` | 熱血サボロー（人格B） | 「搾取されないぞ！と奮い立たせる存在」。情熱的・反骨精神。怒りを引き出してサボりを正当化 | 将来展望（A/Bテスト） |

**インタフェース**:
- `render(verdict: Verdict, reasoning: string[], personaId: string): Promise<string>`

**依存サービス**:
- DynamoDB（Personas テーブル）— 人格A・人格B の両定義を格納

---

### AG-04: ContextCollector（文脈収集ツール）

**責務**:
- 指定タスクに関連する Slack の文脈情報を収集する
- Slack: 関連スレッドのリマインド有無・依頼者のオンライン状態・温度感・緊急キーワードを取得する
- 取得した生データは処理後即削除（NFR-07 準拠）

> v1.1.0 以降で Gmail / Google Calendar コンテキスト収集を追加予定。

**インタフェース**:
- `collectSlackContext(params: CollectSlackParams): Promise<SlackContext>`

**依存サービス**:
- AWS Secrets Manager（Slack OAuth トークン取得）
- Slack Web API

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
- `ServiceType`: `'slack'`  // v1.1.0 以降: `'gmail' | 'google_calendar'` 追加予定

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

- TaskExtractor Lambda + SaboriProposer Lambda + BackgroundRefresh Lambda の IAM ロール設定
- Bedrock converse API 呼び出し権限（claude-3-5-sonnet-20241022 モデル）付与
- Lambda DLQ（EventBridge 失敗時の Dead Letter Queue）設定

### INF-05: FrontendStack

- S3 バケット（React ビルド成果物ホスティング）
- CloudFront ディストリビューション設定
- OAC（Origin Access Control）設定

### INF-06: WebhookStack

- Webhook 受信用 Lambda（独立エンドポイント）
- EventBridge Custom Event Bus
- EventBridge ルール（Slack イベント振り分け。v1.1.0 以降: Gmail / Calendar 追加予定）
