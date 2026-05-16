# サービス定義 — SABOROU

**プロジェクト名**: SABOROU（サボロー）
**作成日**: 2026-05-09
**バージョン**: 1.0.0

---

## 1. サービス概要

SABOROU のサービス層は以下の3カテゴリで構成される。

| カテゴリ | 役割 |
|---------|------|
| **フロントエンドサービス** | UIとバックエンドAPIの仲介。状態管理・キャッシュ |
| **バックエンドサービス** | ビジネスロジック実行・エージェント呼び出し・DynamoDB操作 |
| **エージェントサービス** | AI推論・外部API連携・文脈収集 |

---

## 2. バックエンドサービス定義

### SVC-01: TaskService（タスク管理サービス）

**責務**: タスクライフサイクル（候補 → 承認済み → 完了）の全状態遷移を管理する

**サービスメソッド**:
```
createTaskCandidate(externalEvent: ExternalEvent) → TaskCandidate
  - エージェント①（TaskExtractorAgent）を呼び出す
  - 抽出結果を TaskCandidates テーブルに保存する
  - NFR-01 制約: 10秒以内に完了

approveTask(taskId: string, userId: string) → Task
  - TaskCandidates テーブルから Tasks テーブルにステータスを遷移する
  - 承認完了後、サボり提案生成を非同期でトリガーする

createManualTask(data: ManualTaskInput, userId: string) → Task
  - 手動タスクを Tasks テーブルに直接 approved ステータスで保存する

deleteTask(taskId: string, userId: string) → void
  - TaskCandidates または Tasks テーブルからレコードを削除する
```

**依存サービス**: DataService / AgentService

---

### SVC-02: ProposalService（サボり提案サービス）

**責務**: サボり提案の生成・取得・バックグラウンド更新を管理する

**サービスメソッド**:
```
getOrCreateProposal(taskId: string, userId: string) → Proposal
  - Proposals テーブルに有効な提案が存在する場合はそれを返す
  - 存在しない / 陳腐化している場合は SaboriProposerAgent を呼び出して生成する
  - NFR-02 制約: 10〜20秒以内に完了

triggerBackgroundRefresh(taskIds: string[]) → void
  - EventBridge スケジュールから呼ばれるバックグラウンド再評価
  - 各タスクの next_check_at を確認し、期限到来のものを再評価する

streamProposal(taskId: string, userId: string) → AsyncIterator<ProposalDelta>
  - Bedrock のストリーミングレスポンスをクライアントに中継する
```

**依存サービス**: AgentService / DataService

---

### SVC-03: HonneService（本音データサービス）

**責務**: 本音データの保存と将来の取扱説明書生成原料の蓄積を担う

**サービスメソッド**:
```
recordHonne(taskId: string, userId: string, input: HonneInput) → HonneRecord
  - HonneData テーブルにレコードを保存する
  - タスクID・タイムスタンプ・反応種別・内容を記録する

generatePersonaReply(input: HonneInput, personaId: string) → string
  - PersonaRenderer を呼び出してサボローの返答メッセージを生成する
```

**依存サービス**: AgentService（PersonaRenderer）/ DataService

---

### SVC-04: ConnectionService（外部サービス連携サービス）

**責務**: OAuth トークンのライフサイクル管理（取得・保存・更新・失効検知）を担う

**サービスメソッド**:
```
getConnections(userId: string) → ServiceConnection[]
  - 全連携サービスの状態を返す

exchangeSlackToken(code: string, userId: string) → ServiceConnection
  - Slack OAuth code → access_token 交換
  - Secrets Manager に保存する

exchangeGoogleToken(code: string, scopes: string[], userId: string) → ServiceConnection
  - Google OAuth code → access_token + refresh_token 交換
  - v1.1.0 以降: Gmail / Calendar スコープ追加予定（v1.0 では Cognito Google ログインのみ）

getValidToken(userId: string, service: ServiceType) → string
  - Secrets Manager からトークンを取得する
  - 失効している場合は refresh_token でリフレッシュする
  - リフレッシュ失敗時は TokenExpiredError をスローする
```

**依存サービス**: AWS Secrets Manager / DataService

---

### SVC-05: DataService（データアクセスサービス）

**責務**: DynamoDB へのアクセスを集約し、型安全なデータ操作インタフェースを提供する

**オーケストレーションパターン**: Repository パターン
- 各テーブル操作は専用のリポジトリクラスに委譲する
- ビジネスロジックはサービス層に、データアクセスはリポジトリ層に分離する

---

## 3. エージェントサービス定義

### SVC-06: AgentService（エージェント統合サービス）

**責務**: TaskExtractorAgent / SaboriProposerAgent の呼び出しを統括するファサードを提供する

**サービスメソッド**:
```
runTaskExtraction(event: ExternalEvent) → TaskCandidate
  - TaskExtractorAgent を呼び出す
  - Bedrock タイムアウト / エラーを統一ハンドリングする

runSaboriProposal(taskId: string, context: TaskContext) → Proposal
  - SaboriProposerAgent を呼び出す
  - トークン数ガード（8,000トークン制限）を適用する
  - コスト超過エラーを検知してアラートを発報する

renderPersonaReply(verdict: Verdict, reasoning: string[], personaId: string) → string
  - PersonaRenderer を呼び出す
```

**Bedrock converse API 統合パターン**:
- `ITaskExtractorAgent` / `ISaboriProposerAgent` インタフェース経由で呼び出す
- `IBedrockClient` インタフェース（`ConverseBedrockClient` 実装）で Bedrock converse API + Tool Use を呼び出す
- 将来の AgentCore 移行は `IBedrockClient` 実装を差し替えるだけで対応可能（v1.2.0: AgentCore フォールバック廃止）

---

## 4. イベント駆動サービス（EventBridge）

### SVC-07: WebhookEventService（Webhook イベント処理サービス）

**責務**: 外部サービスの Webhook イベントを受け取り、適切なエージェントに転送する

**フロー**:
```
Slack Webhook 着信
  → WebhookHandler（Lambda）が署名検証
  → EventBridge Custom Bus に "slack.message.received" イベントをパブリッシュ
  → EventBridge ルールが TaskExtractorAgent Lambda をトリガー
  → TaskExtractorAgent がタスク候補を生成
  → Tasks テーブルに書き込み
```

**スケジュールフロー**:
```
EventBridge Scheduler（定期実行）
  → BackgroundRefreshHandler Lambda をトリガー
  → next_check_at が現在時刻を過ぎたタスクを取得
  → SaboriProposerAgent を呼び出して提案を更新
  → Proposals テーブルを更新
```

---

## 5. サービス間オーケストレーション

```
[フロントエンド]
  APIClient → TaskHandler → TaskService → DataService / AgentService
  APIClient → ProposalHandler → ProposalService → AgentService / DataService
  APIClient → HonneHandler → HonneService → AgentService / DataService
  APIClient → ConnectionHandler → ConnectionService → Secrets Manager / DataService

[Webhook フロー]
  POST /webhooks/slack → WebhookHandler → EventBridge → TaskExtractorAgent Lambda

[バックグラウンドフロー]
  EventBridge Scheduler → BackgroundRefresh Lambda → ProposalService → AgentService
```
