# シーケンス図 — SABOROU

**プロジェクト名**: SABOROU（サボロー）
**作成日**: 2026-05-09
**バージョン**: 1.1.0
**更新日**: 2026-05-10（application-design.md 7 より分割 / TaskOrganizerAgent フロー追加）
**対象**: 全7フローのシーケンス図

> 本ファイルは `application-design.md` の §7 を独立ファイルとして切り出したものです。
> 設計概要・コンポーネント図・データモデル・API仕様は [`application-design.md`](application-design.md) を参照。

---

## 7. シーケンス図

### 7.1 タスク自動抽出フロー（FR-01）

> **バージョン注記**: 実線は v1.0.0（M2 MVP）で実装済み。`[v1.1.0]` 注釈は M3 決勝実装予定（非同期・ユーザー応答をブロックしない）。

```mermaid
sequenceDiagram
    participant Slack as Slack API
    participant WH as WebhookHandler
    participant EB as EventBridge
    participant TA as TaskExtractorAgent
    participant BR as Bedrock AgentCore
    participant TO as TaskOrganizerAgent
    participant BR2 as Bedrock AgentCore (Organizer)
    participant DB as DynamoDB
    participant UI as フロントエンド

    Slack->>WH: POST /webhooks/slack (message event)
    WH->>WH: Slack Signing Secret 検証
    WH->>Slack: 200 OK (challenge response)
    WH->>EB: PutEvents (slack.message.received)
    EB->>TA: Lambda 起動
    TA->>BR: InvokeAgent (タスク抽出プロンプト)
    BR-->>TA: 構造化タスク候補 (title/deadline/requester)
    TA->>DB: PutItem (TaskCandidates テーブル)
    DB-->>TA: 書き込み完了
    TA->>TA: 生メッセージ本文を即削除（NFR-07）
    UI->>UI: ポーリング or WebSocket で承認待ちタスク更新
    Note over TA,DB: v1.1.0 以降: TaskOrganizerAgent を非同期起動
    TA->>EB: PutEvents (task.extracted.completed) [v1.1.0]
    EB-->>TO: Lambda 起動（TaskOrganizerAgent）[v1.1.0]
    TO->>DB: QueryItems (TaskCandidates - 同一ユーザー)
    TO->>BR2: InvokeAgent (依存関係分析・サボり余地スコア計算)
    BR2-->>TO: OrganizedTaskPlan (依存グラフ / スコア)
    TO->>DB: PutItem (TaskOrganization テーブル)
```

---

### 7.2 サボり提案生成フロー（FR-03）

> **バージョン注記**: 実線は v1.0.0（M2 MVP）で実装済み。`[v1.1.0]` 注釈は M3 決勝実装予定。v1.0.0 では `organizedPlan = null` として通過する設計。

```mermaid
sequenceDiagram
    participant UI as フロントエンド
    participant API as Hono API
    participant PH as ProposalHandler
    participant SP as SaboriProposerAgent
    participant CC as ContextCollector
    participant SM as Secrets Manager
    participant ExtAPI as 外部API (Slack/Gmail/Calendar)
    participant BR as Bedrock AgentCore
    participant PR as PersonaRenderer
    participant DB as DynamoDB

    UI->>API: GET /api/tasks/:id/proposal?stream=true
    API->>PH: getOrCreateProposal(taskId)
    PH->>DB: GetItem (Proposals テーブル - 最新提案確認)
    DB-->>PH: 提案なし or 陳腐化
    PH->>DB: GetItem (TaskOrganization テーブル - v1.1.0)
    DB-->>PH: OrganizedTaskPlan (依存グラフ / サボり余地スコア) [v1.1.0 / 未存在時は null]
    PH->>SP: propose(taskId, context, organizedPlan)
    SP->>CC: collectSlackContext(taskId)
    CC->>SM: GetSecretValue (Slack token)
    SM-->>CC: OAuth token
    CC->>ExtAPI: Slack API 呼び出し
    ExtAPI-->>CC: コンテキスト情報
    CC->>CC: 生データを即削除（NFR-07）
    CC-->>SP: SlackContext (リマインド有無/依頼者状態)
    SP->>CC: collectCalendarContext(taskId)
    CC->>ExtAPI: Calendar API 呼び出し
    ExtAPI-->>CC: 会議情報
    CC-->>SP: CalendarContext (会議日時)
    SP->>BR: InvokeAgent (サボり判定プロンプト)
    BR-->>SP: verdict + reasoning (stream)
    SP->>PR: render(verdict, reasoning, "saboru_ottori")
    PR->>DB: GetItem (Personas テーブル)
    DB-->>PR: persona template
    PR-->>SP: おっとり口調のチャットメッセージ
    SP->>DB: PutItem (Proposals テーブル)
    SP-->>PH: Proposal (ストリーム)
    PH-->>UI: SSE stream (delta events)
    UI->>UI: チャット画面にリアルタイム表示
```

---

### 7.3 本音データ記録フロー（FR-05）

```mermaid
sequenceDiagram
    participant UI as フロントエンド
    participant API as Hono API
    participant HH as HonneHandler
    participant HS as HonneService
    participant PR as PersonaRenderer
    participant DB as DynamoDB

    UI->>API: POST /api/tasks/:id/honne
    Note over UI,API: body: { type: "quick_reply", content: "たしかに、まだ寝かせる" }
    API->>HH: recordHonne(taskId, input)
    HH->>HS: recordHonne(taskId, userId, input)
    HS->>DB: PutItem (HonneData テーブル)
    Note over HS,DB: taskId / timestamp / type / content / proposalVerdict
    DB-->>HS: 書き込み完了
    HS->>PR: render(verdict, "honne_reply", "saboru_ottori")
    PR-->>HS: "そうだよぉ、まかせといて ☁️"
    HS-->>HH: { saved: true, reply, visionText }
    HH-->>UI: 200 OK { saved: true, reply, visionText }
    UI->>UI: チャット欄にサボローの返答を追加
    UI->>UI: 将来ビジョンテキストを表示
```

---

### 7.4 バックグラウンド再評価フロー（FR-04）

```mermaid
sequenceDiagram
    participant EB as EventBridge Scheduler
    participant BG as BackgroundRefreshHandler
    participant DB as DynamoDB
    participant SP as SaboriProposerAgent
    participant BR as Bedrock AgentCore

    EB->>BG: スケジュール実行（定期）
    BG->>DB: Query (Proposals GSI - nextCheckAt <= now)
    DB-->>BG: 再評価対象タスク一覧
    loop 各タスク
        BG->>SP: propose(taskId, context)
        SP->>BR: InvokeAgent
        BR-->>SP: 新しい verdict + reasoning
        SP->>DB: PutItem (Proposals テーブル - 新レコード)
    end
    BG-->>EB: 実行完了
```

---

### 7.5 認証フロー（FR-07対応）

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant FE as フロントエンド<br/>(React)
    participant CF as CloudFront
    participant Cognito as Cognito User Pools<br/>(Hosted UI)
    participant GoogleIdP as Google Identity Provider
    participant APIGW as API Gateway<br/>(Cognito Authorizer)
    participant Hono as Hono Lambda

    User->>FE: ログインボタンクリック
    FE->>CF: /login リダイレクト
    CF->>Cognito: Hosted UI 表示
    Cognito-->>User: Google ログインボタン表示
    User->>Cognito: Google でログインを選択
    Cognito->>GoogleIdP: OpenID Connect認証リクエスト
    GoogleIdP-->>User: Google認証画面表示
    User->>GoogleIdP: メールアドレス + パスワード入力
    GoogleIdP-->>Cognito: Authorization Code 返却
    Cognito->>Cognito: JWT（ID Token + Access Token）発行
    Cognito-->>FE: リダイレクト + Authorization Code
    FE->>APIGW: POST /api/auth/exchange-token<br/>body: { code }
    APIGW->>Hono: 認証不要エンドポイント
    Hono->>Cognito: Code → Token 交換
    Cognito-->>Hono: JWT（ID Token + Access Token + Refresh Token）
    Hono-->>FE: 200 OK { idToken, accessToken, refreshToken }
    FE->>FE: トークンを localStorage / sessionStorage に保存
    FE->>APIGW: GET /api/tasks<br/>Header: Authorization: Bearer {idToken}
    APIGW->>APIGW: Cognito Authorizer で JWT 検証
    APIGW->>Hono: JWT検証成功 → userId 付与
    Hono-->>FE: 200 OK { candidates: [...], approved: [...] }
    FE->>FE: タスク一覧画面表示
```

**重要ポイント**:
- Cognito Hosted UI を使用（カスタムログイン画面は MVP 外）
- JWT の有効期限は **ID Token: 1時間** / **Refresh Token: 30日**
- フロントエンドは ID Token 期限切れ時に自動リフレッシュを試みる
- リフレッシュ失敗時は強制ログアウト → ログイン画面にリダイレクト

---

### 7.6 外部サービス連携設定フロー（FR-07対応）

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant FE as フロントエンド<br/>(設定画面)
    participant APIGW as API Gateway
    participant Hono as Hono Lambda<br/>(ConnectionHandler)
    participant SM as Secrets Manager
    participant Slack as Slack OAuth
    participant Google as Google OAuth

    User->>FE: 設定画面で「Slack と連携」ボタンクリック
    FE->>Slack: Slack OAuth 認可リクエスト<br/>scope: channels:read, chat:write, reactions:read
    Slack-->>User: Slack認証画面表示
    User->>Slack: ワークスペース選択 + 承認
    Slack-->>FE: リダイレクト + Authorization Code
    FE->>APIGW: POST /api/connections/slack/callback<br/>body: { code }
    APIGW->>Hono: Cognito Authorizer 検証（userId 取得）
    Hono->>Slack: Code → Access Token 交換
    Slack-->>Hono: { access_token, team_id, user_id }
    Hono->>SM: PutSecretValue<br/>name: saborou/slack/{userId}<br/>value: { access_token, team_id }
    SM-->>Hono: 保存完了
    Hono->>Hono: ServiceConnections テーブルに記録<br/>PK: userId / SK: slack / status: active
    Hono-->>FE: 200 OK { service: "slack", status: "active" }
    FE->>FE: 「連携済み ✓」バッジを表示

    Note over User,Google: Google（Gmail + Calendar）連携も同様のフロー
    User->>FE: 「Google と連携」ボタンクリック
    FE->>Google: Google OAuth 認可リクエスト<br/>scope: gmail.readonly, calendar.readonly
    Google-->>User: Google認証画面表示
    User->>Google: アカウント選択 + 承認
    Google-->>FE: リダイレクト + Authorization Code
    FE->>APIGW: POST /api/connections/google/callback<br/>body: { code }
    APIGW->>Hono: Cognito Authorizer 検証（userId 取得）
    Hono->>Google: Code → Access Token + Refresh Token 交換
    Google-->>Hono: { access_token, refresh_token, expires_in }
    Hono->>SM: PutSecretValue<br/>name: saborou/google/{userId}<br/>value: { refresh_token }
    SM-->>Hono: 保存完了
    Hono->>Hono: ServiceConnections テーブルに記録<br/>PK: userId / SK: google / status: active
    Hono-->>FE: 200 OK { service: "google", status: "active" }
    FE->>FE: 「連携済み ✓」バッジを表示
```

**重要ポイント**:
- Access Token は Secrets Manager に保存（環境変数・DynamoDB に保存しない）
- Refresh Token も暗号化保存し、Access Token 期限切れ時に自動リフレッシュ
- 連携解除は `DELETE /api/connections/:service` エンドポイントで対応
- Webhook URL（Slack Events API）は infra デプロイ時に Slack App に登録

---

### 7.7 エラーハンドリングフロー（NFR-05対応）

```mermaid
sequenceDiagram
    participant FE as フロントエンド
    participant APIGW as API Gateway
    participant Hono as Hono Lambda
    participant SP as SaboriProposerAgent
    participant CC as ContextCollector
    participant Slack as Slack API
    participant BR as Bedrock
    participant CW as CloudWatch

    FE->>APIGW: GET /api/tasks/:id/proposal?stream=true
    APIGW->>Hono: JWT検証成功
    Hono->>SP: propose(taskId, context)
    SP->>CC: collectSlackContext(taskId)
    CC->>Slack: GET /conversations.history（タイムアウト30秒）
    Note over CC,Slack: ❌ タイムアウト発生
    Slack--xCC: Request Timeout (30秒超)
    CC->>CW: ログ記録「Slack API Timeout」+ メトリクス増加
    CC-->>SP: { slackContext: null, error: "SlackTimeoutError" }
    SP->>SP: Slack コンテキストなしで推論を継続
    SP->>BR: InvokeAgent（プロンプト: Calendar/Gmail コンテキストのみ）
    BR-->>SP: verdict + reasoning（stream）
    SP-->>Hono: Proposal（Slack 警告フラグ付き）
    Hono-->>FE: SSE stream（delta events）
    FE->>FE: チャット画面に表示 + 警告バナー<br/>「Slack との連携で問題が発生しました」

    Note over FE,CW: Bedrock タイムアウトシナリオ
    FE->>APIGW: GET /api/tasks/:id/proposal?stream=true
    APIGW->>Hono: JWT検証成功
    Hono->>SP: propose(taskId, context)
    SP->>BR: InvokeAgent（タイムアウト20秒）
    Note over SP,BR: ❌ 20秒超過
    BR--xSP: Bedrock Timeout
    SP->>CW: ログ記録「Bedrock Timeout」+ CloudWatch Alarm 発火
    SP->>BR: フォールバック: InvokeModel（直接呼び出し）
    BR-->>SP: verdict + reasoning（非ストリーム）
    SP-->>Hono: Proposal（Bedrock警告フラグ付き）
    Hono-->>FE: SSE complete event
    FE->>FE: チャット画面に表示 + 警告バナー<br/>「提案の生成に時間がかかりました」

    Note over FE,CW: OAuth Token 期限切れシナリオ
    FE->>APIGW: GET /api/tasks/:id/proposal?stream=true
    APIGW->>Hono: JWT検証成功
    Hono->>SP: propose(taskId, context)
    SP->>CC: collectGmailContext(taskId)
    CC->>CC: Secrets Manager から OAuth token 取得
    CC->>CC: Gmail API 呼び出し（token使用）
    Note over CC: ❌ Token 期限切れ
    CC-->>CC: 401 Unauthorized
    CC->>CC: Refresh Token で再取得試行
    CC->>CC: Refresh Token も期限切れ
    CC->>CW: ログ記録「Gmail Token Expired」
    CC-->>SP: { gmailContext: null, error: "TokenExpiredError" }
    SP-->>Hono: TokenExpiredError を伝播
    Hono-->>FE: 401 Unauthorized<br/>body: { error: "TokenExpired", service: "gmail" }
    FE->>FE: バナー表示<br/>「Gmail との連携が切れています。再連携してください」<br/>+ 設定画面へのリンク
```

**重要ポイント**:
- 外部API失敗時は**部分的なコンテキストで推論を継続**（完全失敗にしない）
- Bedrock タイムアウト時は**フォールバック戦略**（InvokeModel 直接呼び出し）
- OAuth Token 期限切れ時は**再連携を促すバナー**を表示
- 全エラーは CloudWatch Logs に記録し、重大エラーは CloudWatch Alarm で通知

---

*本ファイルは `application-design.md` §7 の分割ファイルです。*
*ビジネスルール・セキュリティ設計・トレーサビリティは [`design-rules.md`](design-rules.md) を参照。*
