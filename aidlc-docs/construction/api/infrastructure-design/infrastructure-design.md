# Infrastructure Design — U-04: api

**Unit**: U-04: api
**ステージ**: CONSTRUCTION / Infrastructure Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. インフラ概要

U-04 api の実装は `pkgs/backend` に配置し、2 つの Lambda 関数から参照される。

| Lambda 関数 | CDK スタック | コードパス | ハンドラ |
|-----------|------------|----------|---------|
| `saborou-api-{env}` | SaborouApiStack | `pkgs/backend/dist/` | `index.handler` |
| `saborou-webhook-{env}` | SaborouWebhookStack | `pkgs/backend/dist/` | `webhook.handler` |

両関数とも **既存の CDK スタック** で定義済み。U-04 Code Generation では以下を実施する：
1. `pkgs/backend/src` にルート・ミドルウェア・リポジトリを実装
2. CDK ApiStack と WebhookStack の **環境変数・IAM 権限の不足分を追記**

---

## 2. 使用 AWS リソース

### 2.1 既存リソース（変更なし）

| リソース | 名称 | スタック | U-04 での使用 |
|---------|------|---------|-------------|
| Lambda | `saborou-api-{env}` | ApiStack | Hono API（14 エンドポイント）|
| Lambda | `saborou-webhook-{env}` | WebhookStack | Slack Webhook 受信 |
| HTTP API | `saborou-api-{env}` | ApiStack | エンドポイント公開・JWT Authorizer |
| JWT Authorizer | CognitoJwtAuthorizer | ApiStack | Cognito トークン検証 |
| DynamoDB: Users | `saborou-users-{env}` | DataStack | ユーザー情報 |
| DynamoDB: ServiceConnections | `saborou-connections-{env}` | DataStack | Slack OAuth トークン管理 |
| DynamoDB: TaskCandidates | `saborou-task-candidates-{env}` | DataStack | 候補一覧 |
| DynamoDB: Tasks | `saborou-tasks-{env}` | DataStack | 承認済みタスク |
| DynamoDB: Proposals | `saborou-proposals-{env}` | DataStack | サボり提案キャッシュ |
| DynamoDB: HonneData | `saborou-honne-data-{env}` | DataStack | 本音データ |
| Secrets Manager | `slackSigningSecret` | DataStack | Slack Signing Secret |
| EventBridge | `saborou-event-bus-{env}` | WebhookStack | Slack イベント転送 |
| Cognito UserPool | `saborou-user-pool-{env}` | CognitoStack | Google OAuth / JWT |
| CloudWatch LogGroups | `/aws/lambda/saborou-api-{env}` 等 | ApiStack/WebhookStack | 構造化ログ |

---

## 3. CDK 変更点（U-04 Code Generation で修正）

### 3.1 ApiStack (pkgs/cdk/lib/stacks/api-stack.ts)

#### 変更 1: honoFn 環境変数追加

現在の ApiStack に `SLACK_SIGNING_SECRET_ARN` が欠如している（Hono API からは Webhook 署名検証を行わないため不要）。ただし Cognito の `userPoolId` が欠如しているため以下を追加:

```typescript
// 追加する環境変数
environment: {
  ENVIRONMENT: environment,
  COGNITO_USER_POOL_ID: props.cognito.userPool.userPoolId,          // 追加: 認証 exchange-token 用
  COGNITO_CLIENT_ID: props.cognito.userPoolClient.userPoolClientId, // 追加: 認証 exchange-token 用
  // 既存はそのまま維持
  DYNAMODB_TABLE_USERS: props.data.tables.users.tableName,
  DYNAMODB_TABLE_CONNECTIONS: props.data.tables.connections.tableName,
  DYNAMODB_TABLE_TASK_CANDIDATES: props.data.tables.taskCandidates.tableName,
  DYNAMODB_TABLE_TASKS: props.data.tables.tasks.tableName,
  DYNAMODB_TABLE_PROPOSALS: props.data.tables.proposals.tableName,
  DYNAMODB_TABLE_HONNE_DATA: props.data.tables.honneData.tableName,
  DYNAMODB_TABLE_PERSONAS: props.data.tables.personas.tableName,
},
```

#### 変更 2: Secrets Manager 権限追加

honoFn から Slack OAuth のクライアントシークレット（サービス連携フロー）にアクセス:

```typescript
// 追加
props.data.secrets.slackClientSecret.grantRead(honoFn);
```

#### 変更 3: honoFn コードパス確認

現在 `code: lambda.Code.fromAsset('../../pkgs/backend/dist')` — 変更なし（U-04 でビルド済みファイルを配置）

### 3.2 WebhookStack (pkgs/cdk/lib/stacks/webhook-stack.ts)

#### 変更なし

WebhookStack は既存の定義で完結している：
- `SLACK_SIGNING_SECRET_ARN` 環境変数: 設定済み
- `EVENT_BUS_NAME` 環境変数: 設定済み
- `grantRead(webhookFn)` for slackSigningSecret: 設定済み
- `grantPutEventsTo(webhookFn)` for EventBridge: 設定済み
- `handler: 'webhook.handler'` — U-04 で `src/webhook-handler.ts` として実装

---

## 4. エントリポイント構成（pkgs/backend）

### 4.1 Lambda エントリポイント分割

```
pkgs/backend/
├── src/
│   ├── index.ts        # Hono app factory（APIルート登録）
│   ├── handler.ts      # API Lambda エントリ: handle(app)
│   └── webhook-handler.ts  # Webhook Lambda エントリ: 別 Hono app
├── dist/
│   ├── index.js        # esbuild バンドル → handler: 'index.handler'
│   └── webhook.js      # esbuild バンドル → handler: 'webhook.handler'
└── package.json        # ビルドスクリプト更新
```

### 4.2 ビルドスクリプト更新（package.json）

```json
{
  "scripts": {
    "build": "run-s build:clean build:api build:webhook",
    "build:clean": "rm -rf dist",
    "build:api": "esbuild --bundle --outfile=dist/index.js --platform=node --target=node22 --external:@aws-sdk/* src/handler.ts",
    "build:webhook": "esbuild --bundle --outfile=dist/webhook.js --platform=node --target=node22 --external:@aws-sdk/* src/webhook-handler.ts",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "dev": "tsx src/index.ts"
  }
}
```

**注意**: `--external:@aws-sdk/*` で Lambda ランタイム組み込みの AWS SDK を除外してバンドルサイズを削減する。

---

## 5. 環境変数一覧（Lambda ランタイム）

### saborou-api-{env}（ApiStack の honoFn）

| 変数名 | 値 | CDK 変更 |
|-------|-----|---------|
| `ENVIRONMENT` | `dev` / `prod` | 既存 |
| `COGNITO_USER_POOL_ID` | UserPool ID | **追加** |
| `COGNITO_CLIENT_ID` | UserPoolClient ID | **追加** |
| `DYNAMODB_TABLE_USERS` | テーブル名 | 既存 |
| `DYNAMODB_TABLE_CONNECTIONS` | テーブル名 | 既存 |
| `DYNAMODB_TABLE_TASK_CANDIDATES` | テーブル名 | 既存 |
| `DYNAMODB_TABLE_TASKS` | テーブル名 | 既存 |
| `DYNAMODB_TABLE_PROPOSALS` | テーブル名 | 既存 |
| `DYNAMODB_TABLE_HONNE_DATA` | テーブル名 | 既存 |
| `DYNAMODB_TABLE_PERSONAS` | テーブル名 | 既存（一覧表示用に残す）|
| `SLACK_CLIENT_SECRET_ARN` | Secrets Manager ARN | **追加**（Slack OAuth callback 用）|

### saborou-webhook-{env}（WebhookStack の webhookFn）

| 変数名 | 値 | CDK 変更 |
|-------|-----|---------|
| `ENVIRONMENT` | `dev` / `prod` | 既存 |
| `EVENT_BUS_NAME` | EventBus 名 | 既存 |
| `SLACK_SIGNING_SECRET_ARN` | Secrets Manager ARN | 既存 |

---

## 6. IAM 権限マトリクス

| Lambda | リソース | 権限 | CDK メソッド |
|--------|---------|------|------------|
| saborou-api | DynamoDB users | Read/Write | grantReadWriteData |
| saborou-api | DynamoDB connections | Read/Write | grantReadWriteData |
| saborou-api | DynamoDB taskCandidates | Read/Write | grantReadWriteData（candidatesの削除に Write 必要）|
| saborou-api | DynamoDB tasks | Read/Write | grantReadWriteData |
| saborou-api | DynamoDB proposals | Read | grantReadData（書き込みはAgent担当）|
| saborou-api | DynamoDB honneData | Read/Write | grantReadWriteData |
| saborou-api | DynamoDB personas | Read | grantReadData |
| saborou-api | Secrets Manager slackClientSecret | Read | grantRead |
| saborou-webhook | EventBridge put | PutEvents | grantPutEventsTo |
| saborou-webhook | Secrets Manager slackSigningSecret | Read | grantRead |

**注意**: 既存 ApiStack では `taskCandidates.grantReadData(honoFn)` が設定されているが、
候補削除（`ITaskCandidateRepository.delete`）には Write 権限も必要なため
`grantReadWriteData` に変更する。

---

## 7. ローカル開発環境

```bash
# pkgs/backend ローカル起動
cd pkgs/backend
pnpm dev  # tsx src/index.ts → http://localhost:3000

# 環境変数（.env.local）
ENVIRONMENT=dev
DYNAMODB_TABLE_USERS=saborou-users-dev
DYNAMODB_TABLE_TASKS=saborou-tasks-dev
# ... 他のテーブル名
# AWS_PROFILE や AWS_ACCESS_KEY_ID は ~/.aws/credentials から取得
```

---

## 8. Well-Architected 6 本柱 準拠確認

| 柱 | 準拠内容 |
|----|---------|
| 運用性 | 構造化ログ（CloudWatch Logs Insights）・X-Ray トレース |
| セキュリティ | JWT Authorizer（API Gateway）・Slack HMAC 検証・Secrets Manager・最小権限 IAM |
| 信頼性 | グローバルエラーハンドラ・TransactWriteItems 原子性・タイムアウト 29 秒設計 |
| パフォーマンス | ARM64 + esbuild バンドル・DynamoDB GSI・Secrets Manager キャッシュ |
| コスト最適化 | サーバーレス（Lambda on demand）・SSE キャッシュで Bedrock 呼び出し削減 |
| 持続可能性 | ARM64 による消費電力削減 |
