# コンポーネント依存関係 — SABOROU

**プロジェクト名**: SABOROU（サボロー）
**作成日**: 2026-05-09
**バージョン**: 1.0.0

---

## 1. 依存関係マトリクス

凡例: `→` = 依存先、`-` = 依存なし

| コンポーネント | packages/shared | apps/api | packages/agent | infra/ | 外部サービス |
|--------------|:---------------:|:--------:|:--------------:|:------:|:----------:|
| apps/web | 型定義 | REST API | - | - | Cognito（認証）|
| apps/api | 型定義 | - | AG-01〜AG-04 | - | DynamoDB / Cognito / EventBridge / Secrets Manager |
| packages/agent | 型定義 | - | AG-03→AG-04 | - | Bedrock converse API / Secrets Manager / Slack |
| infra/ | - | Lambda（デプロイ対象）| Lambda（デプロイ対象）| - | AWS（全サービス）|

---

## 2. フロントエンドコンポーネント間依存関係

```
AppShell（FE-05）
  └── AuthProvider（FE-06）     ← 全 Page が依存
      ├── LoginPage（FE-03）
      ├── TaskListPage（FE-01）
      │   ├── TaskCard（FE-08）
      │   └── APIClient（FE-07）
      ├── TaskDetailPage（FE-02）
      │   └── APIClient（FE-07）
      └── SettingsPage（FE-04）
          └── APIClient（FE-07）

APIClient（FE-07）
  └── packages/shared（型定義・エラークラス）
```

---

## 3. バックエンドコンポーネント間依存関係

```
apps/api（Hono アプリ）
  ├── AuthHandler（BE-01）← 全ハンドラが依存（JWT ミドルウェア）
  ├── TaskHandler（BE-02）
  │   └── TaskService（SVC-01）
  │       ├── DataService（SVC-05）→ DynamoDB
  │       └── AgentService（SVC-06）→ packages/agent
  ├── ProposalHandler（BE-03）
  │   └── ProposalService（SVC-02）
  │       ├── DataService（SVC-05）→ DynamoDB
  │       └── AgentService（SVC-06）→ packages/agent
  ├── HonneHandler（BE-04）
  │   └── HonneService（SVC-03）
  │       ├── DataService（SVC-05）→ DynamoDB
  │       └── AgentService（SVC-06）→ packages/agent（PersonaRenderer）
  ├── ConnectionHandler（BE-05）
  │   └── ConnectionService（SVC-04）
  │       ├── DataService（SVC-05）→ DynamoDB
  │       └── Secrets Manager
  └── WebhookHandler（BE-06）
      └── EventBridge
```

---

## 4. エージェントコンポーネント間依存関係

```
packages/agent
  ├── TaskExtractorAgent（AG-01）
  │   ├── ITaskExtractorAgent（インタフェース）
  │   ├── Bedrock converse API + Tool Use（IBedrockClient 経由）
  │   └── packages/shared（型定義・トークンガード）
  │
  └── SaboriProposerAgent（AG-02）
      ├── ISaboriProposerAgent（インタフェース）
      ├── ContextCollector（AG-04）← 文脈収集（v1.0.0: Slack のみ）
      │   └── Secrets Manager（OAuth トークン）
      │       └── Slack API
      ├── PersonaRenderer（AG-03）← 口調変換
      │   └── DynamoDB（Personas テーブル）
      ├── Bedrock converse API + Tool Use（IBedrockClient 経由）
      └── packages/shared（型定義・トークンガード）
```

---

## 5. インフラスタック間依存関係

```
CognitoStack（INF-01）
  ← ApiStack（INF-03）が参照（JWT オーソライザー設定）
  ← FrontendStack（INF-05）が参照（CORS 許可オリジン）

DataStack（INF-02）
  ← ApiStack（INF-03）が参照（DynamoDB テーブル ARN）
  ← AgentStack（INF-04）が参照（DynamoDB テーブル ARN）
  ← WebhookStack（INF-06）が参照（DynamoDB テーブル ARN）

AgentStack（INF-04）
  ← ApiStack（INF-03）が参照（Lambda ARN）
  ← WebhookStack（INF-06）が参照（Lambda ARN）

WebhookStack（INF-06）
  ← ApiStack（INF-03）が参照（EventBridge Bus ARN）

FrontendStack（INF-05）
  ← 独立（他スタックへの直接依存なし）
```

---

## 6. モノレポパッケージ参照関係

```
packages/shared
  ↑ 参照される方向
  apps/web
  apps/api
  packages/agent

packages/agent
  ↑ 参照される方向
  apps/api

infra/
  ← apps/web、apps/api、packages/agent のビルド成果物をデプロイ対象として参照
```

---

## 7. 外部サービス依存関係マップ

| 外部サービス | 呼び出しコンポーネント | 認証方式 | 障害時の影響 |
|------------|---------------------|---------|------------|
| Amazon Bedrock（converse API） | AgentService（SVC-06）経由で全エージェント | IAM ロール | サボり提案・タスク抽出が停止 |
| Slack API | AG-04（ContextCollector） | OAuth Bearer Token | Slack 文脈が欠落（タスクタイトルのみで提案生成）|
| Cognito | BE-01（AuthHandler）/ FE-06（AuthProvider） | Cognito SDK | 認証不能（全機能利用不可） |
| DynamoDB | SVC-05（DataService）経由で全サービス | IAM ロール | データ読み書き不能（全機能停止）|
| Secrets Manager | SVC-04（ConnectionService）/ AG-04 | IAM ロール | OAuth トークン取得不可（外部API停止）|
| EventBridge | BE-06（WebhookHandler）/ INF-06 | IAM ロール | Webhook 処理が停止（バックグラウンド更新停止）|
| S3 / CloudFront | INF-05（FrontendStack） | OAC | フロントエンド配信停止 |

---

## 8. 循環依存の禁止ルール

以下の依存方向は **禁止**:

- `packages/shared` が他パッケージに依存する（shared は依存されるのみ）
- `packages/agent` が `apps/api` または `apps/web` に依存する
- `apps/api` が `apps/web` に依存する
- `infra/` が実行時にアプリコードを直接呼び出す

---

## 9. 通信パターン

| パターン | 使用箇所 | 理由 |
|---------|---------|------|
| REST HTTP（同期） | apps/web → apps/api | 標準的な CRUD・即時応答が必要 |
| Server-Sent Events | apps/web ← apps/api（提案ストリーミング）| Bedrock ストリーミングの体感速度向上 |
| EventBridge（非同期） | apps/api → packages/agent（Webhook トリガー）| Webhook 応答速度確保・処理分離 |
| EventBridge Scheduler | → packages/agent（バックグラウンド更新）| 定期再評価の非同期実行 |
| DynamoDB Streams（将来）| DataStack → 他 Lambda | リアルタイム通知の拡張（MVP 外）|
