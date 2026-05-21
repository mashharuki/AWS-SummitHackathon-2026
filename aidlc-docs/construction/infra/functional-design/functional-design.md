# Functional Design — U-02: infra

**Unit**: U-02: infra
**ステージ**: CONSTRUCTION / Functional Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0
**参照**:
- `inception/application-design/infra-components.md`（IN-01〜IN-06 スタック定義）
- `inception/application-design/aws-architecture.md`（AWSアーキテクチャ全体）
- `inception/application-design/dynamodb-access-patterns.md`（DynamoDB GSI 設計）
- `inception/application-design/components.md`（コンポーネント定義）
- `inception/units/unit-of-work.md`（U-02 スコープ定義）
- `construction/shared/nfr-requirements/nfr-requirements.md`（品質最大化方針）
- `.claude/rules/aws-constraints.md`（サーバーレス優先・最小権限IAM）

---

## 概要

U-02: infra は `pkgs/cdk/` に AWS CDK v2 (TypeScript) で全インフラリソースを定義する Unit である。
`@saboru/shared` の型定義を参照し、DynamoDB テーブル名・GSI名・環境変数キーなどの定数を一元管理する。

6 つの CDK スタックを適切な依存順序でデプロイし、SABOROU の全 AWS リソースをプロビジョニングする。

---

## 1. スタック責務定義

### 1.1 スタック一覧と責務

| スタック ID | クラス名 | 主責務 | 依存スタック |
|------------|---------|--------|-----------|
| IN-01 | `SaborouCognitoStack` | Cognito User Pool + Google OAuth 統合 + JWT 発行 | なし |
| IN-02 | `SaborouDataStack` | DynamoDB 7テーブル + Secrets Manager（OAuth トークン用シークレット） | なし |
| IN-03 | `SaborouApiStack` | API Gateway HTTP API + Hono Lambda + Cognito JWT オーソライザー | IN-01, IN-02 |
| IN-04 | `SaborouAgentStack` | TaskExtractor Lambda + SaboriProposer Lambda + Bedrock IAM + DLQ（SQS） | IN-02 |
| IN-05 | `SaborouWebhookStack` | Webhook Lambda + EventBridge Bus/Rules + EventBridge Scheduler | IN-02, IN-04 |
| IN-06 | `SaborouFrontendStack` | CloudFront Distribution + S3 Bucket（OAC 設定） | IN-03 |

### 1.2 スタック間 Props の受け渡しモデル

```
SaborouCognitoStack
  └── exports: userPool, userPoolClient, userPoolDomain
        └──> SaborouApiStack.props.cognito

SaborouDataStack
  └── exports: tables (7テーブル), secretArns (3シークレット)
        ├──> SaborouApiStack.props.data
        ├──> SaborouAgentStack.props.data
        └──> SaborouWebhookStack.props.data

SaborouAgentStack
  └── exports: taskExtractorFn, saboriProposerFn
        └──> SaborouWebhookStack.props.agents

SaborouApiStack
  └── exports: httpApiUrl
        └──> SaborouFrontendStack.props.apiUrl（CloudFront オリジン設定用）
```

---

## 2. 各スタックのリソース定義

### 2.1 SaborouCognitoStack（IN-01）

**リソース一覧**:

| リソース | CDK クラス | 設定要点 |
|---------|-----------|---------|
| Cognito User Pool | `cognito.UserPool` | 自己サインアップ無効・メール必須・パスワードポリシー設定 |
| Google Identity Provider | `cognito.UserPoolIdentityProviderGoogle` | clientId → SSM / clientSecret → Secrets Manager |
| User Pool Client | `cognito.UserPoolClient` | Authorization Code Grant / PKCE / コールバック URL |
| Cognito Domain | `cognito.UserPoolDomain` | `saborou-auth` プレフィックス |

**Key Design**: 自己サインアップ無効（ハッカソン期間中は管理者のみユーザー作成）。Google IdP の認証情報はコードにハードコードせず SSM Parameter Store（clientId）と Secrets Manager（clientSecret）から参照する。

---

### 2.2 SaborouDataStack（IN-02）

**DynamoDB テーブル一覧（7テーブル、全て PAY_PER_REQUEST）**:

| テーブル | PK | SK | GSI |
|---------|----|----|-----|
| `saborou-users` | `USER#<cognitoSub>` | `PROFILE` | なし |
| `saborou-service-connections` | `USER#<cognitoSub>` | `CONN#<service>` | なし |
| `saborou-task-candidates` | `USER#<cognitoSub>` | `TASK_CAND#<ulid>` | GSI-UserCreatedAt (PK: userId, SK: createdAt) |
| `saborou-tasks` | `USER#<cognitoSub>` | `TASK#<ulid>` | GSI-UserStatus (PK: userId, SK: status) |
| `saborou-proposals` | `TASK#<taskId>` | `PROPOSAL#<ISO8601>` | GSI-TaskLatest (PK: taskId, SK: evaluatedAt) |
| `saborou-honne-data` | `USER#<cognitoSub>` | `HONNE#<ISO8601>` | GSI-UserCreatedAt (PK: userId, SK: createdAt) |
| `saborou-personas` | `PERSONA#<personaId>` | `DEFINITION` | なし |

**TTL 設定**:
- `saborou-task-candidates`: TTL 属性 `ttl`（Unix 時刻、30日後）を有効化

**Secrets Manager シークレット（プレースホルダー作成）**:
- `/saborou/google/client-secret`（Google OAuth クライアントシークレット）
- `/saborou/slack/client-secret`（Slack OAuth クライアントシークレット）
- `/saborou/slack/signing-secret`（Slack 署名検証シークレット）

**SSM Parameter Store パラメータ（プレースホルダー作成）**:
- `/saborou/google/client-id`（Google OAuth クライアント ID）
- `/saborou/slack/client-id`（Slack OAuth クライアント ID）

---

### 2.3 SaborouApiStack（IN-03）

**リソース一覧**:

| リソース | CDK クラス | 設定要点 |
|---------|-----------|---------|
| Hono Lambda Function | `lambda.Function` | ARM64 / Node.js 22.x / 256MB / 29秒タイムアウト |
| API Gateway HTTP API | `apigatewayv2.HttpApi` | CORS 設定（CloudFront Origin のみ許可）|
| HTTP API ルート | `apigatewayv2.HttpRoute` | `ANY /{proxy+}` → Hono Lambda |
| Lambda 統合 | `apigatewayv2Integrations.HttpLambdaIntegration` | ペイロード形式バージョン 2.0 |
| JWT オーソライザー | `apigatewayv2Authorizers.HttpJwtAuthorizer` | Cognito ユーザープール URL / audience: userPoolClientId |
| CloudWatch Log Group | `logs.LogGroup` | 保持期間 14日（コスト最適化）|

**IAM 権限（最小権限）**:
- DynamoDB: `table.grantReadWriteData(honoFn)` × 全 7 テーブル
- Secrets Manager: `secret.grantRead(honoFn)` × Slack/Google シークレット
- Lambda Invoke: `taskExtractorFn.grantInvoke(honoFn)` / `saboriProposerFn.grantInvoke(honoFn)`

---

### 2.4 SaborouAgentStack（IN-04）

**リソース一覧**:

| リソース | CDK クラス | 設定要点 |
|---------|-----------|---------|
| TaskExtractor Lambda | `lambda.Function` | ARM64 / Node.js 22.x / 512MB / 60秒タイムアウト（Bedrock 呼び出しを含む）|
| SaboriProposer Lambda | `lambda.Function` | ARM64 / Node.js 22.x / 512MB / 60秒タイムアウト |
| TaskExtractor DLQ | `sqs.Queue` | 保持期間 1日（ハッカソンスコープ）|
| SaboriProposer DLQ | `sqs.Queue` | 保持期間 1日 |
| Bedrock IAM Policy | `iam.PolicyStatement` | `bedrock:InvokeModel` / `bedrock:InvokeModelWithResponseStream` / Resource: Claude Sonnet ARN |

**IAM 権限（各 Lambda）**:

TaskExtractor Lambda:
- `taskCandidatesTable.grantReadWriteData(taskExtractorFn)`
- `tasksTable.grantReadData(taskExtractorFn)`
- `bedrock:InvokeModel` / `bedrock:InvokeModelWithResponseStream` に対する個別 IAM ポリシー

SaboriProposer Lambda:
- `proposalsTable.grantReadWriteData(saboriProposerFn)`
- `tasksTable.grantReadData(saboriProposerFn)`
- `personasTable.grantReadData(saboriProposerFn)`
- `slackSecretArn` の Secrets Manager シークレットへの `grantRead`
- `bedrock:InvokeModel` / `bedrock:InvokeModelWithResponseStream` に対する個別 IAM ポリシー

---

### 2.5 SaborouWebhookStack（IN-05）

**リソース一覧**:

| リソース | CDK クラス | 設定要点 |
|---------|-----------|---------|
| Webhook Lambda | `lambda.Function` | ARM64 / Node.js 22.x / 256MB / 10秒タイムアウト（Slack 3秒以内に ACK 必須のため非同期設計）|
| Custom EventBridge Bus | `events.EventBus` | `saborou-event-bus`（デフォルトバスは使用しない）|
| EventBridge Rule (Slack) | `events.Rule` | source: `saborou.webhook` / detail-type: `SlackEvent` → TaskExtractor Lambda |
| EventBridge Scheduler | `scheduler.Schedule` | 毎時 `rate(1 hour)` → SaboriProposer Lambda（バックグラウンド再評価）|
| Scheduler IAM Role | `iam.Role` | `scheduler.amazonaws.com` サービスプリンシパル / Lambda Invoke 権限のみ |

**IAM 権限**:
- `webhookFn.grantInvoke(eventBusRule)` は不要（EventBridge → Lambda は Rule Target で管理）
- `eventBus.grantPutEventsTo(webhookFn)`
- `slackSigningSecretArn` の Secrets Manager シークレットへの `grantRead` (webhookFn)

---

### 2.6 SaborouFrontendStack（IN-06）

**リソース一覧**:

| リソース | CDK クラス | 設定要点 |
|---------|-----------|---------|
| S3 バケット | `s3.Bucket` | BlockPublicAccess.BLOCK_ALL / enforceSSL: true / 保存時暗号化（S3 管理）|
| Origin Access Control | `cloudfront.S3OriginAccessControl` | S3 Origins 用（Legacy OAI ではなく OAC を使用）|
| CloudFront Distribution | `cloudfront.Distribution` | デフォルトルートオブジェクト: `index.html` / HTTPS リダイレクト |
| CloudFront エラーレスポンス | - | 404 → 200 / `index.html`（SPA ルーティング対応）|
| カスタムキャッシュポリシー | `cloudfront.CachePolicy` | TTL min: 0, max: 31536000（静的アセット向け）|

**OAC 設定（セキュリティ）**:
- S3 バケットポリシーに CloudFront OAC からのアクセスのみ許可
- パブリックアクセスは一切不可
- S3 ウェブサイトホスティング機能は使用しない（CDN 経由のみ）

---

## 3. 共通設計パターン

### 3.1 環境変数管理

全 Lambda は以下の命名規則で環境変数を注入する（値はハードコードせず CDK から渡す）:

```typescript
// 例: HonoFunction
environment: {
  COGNITO_USER_POOL_ID: props.cognito.userPool.userPoolId,
  COGNITO_CLIENT_ID: props.cognito.userPoolClient.userPoolClientId,
  DYNAMODB_TABLE_USERS: props.data.usersTable.tableName,
  DYNAMODB_TABLE_TASKS: props.data.tasksTable.tableName,
  DYNAMODB_TABLE_TASK_CANDIDATES: props.data.taskCandidatesTable.tableName,
  DYNAMODB_TABLE_PROPOSALS: props.data.proposalsTable.tableName,
  DYNAMODB_TABLE_HONNE_DATA: props.data.honneDataTable.tableName,
  DYNAMODB_TABLE_SERVICE_CONNECTIONS: props.data.connectionsTable.tableName,
  DYNAMODB_TABLE_PERSONAS: props.data.personasTable.tableName,
  SLACK_CLIENT_SECRET_ARN: props.data.slackClientSecretArn,
  SLACK_SIGNING_SECRET_ARN: props.data.slackSigningSecretArn,
  AWS_REGION: 'ap-northeast-1',
}
```

### 3.2 RemovalPolicy 設計

| リソース種別 | RemovalPolicy | 理由 |
|------------|--------------|------|
| DynamoDB テーブル | `RETAIN` | データ喪失防止（ハッカソンデータは貴重）|
| Secrets Manager | `RETAIN` | OAuth トークン喪失防止 |
| S3 バケット | `DESTROY` + `autoDeleteObjects: true` | フロントエンドビルド成果物は再デプロイ可能 |
| CloudFront | `DESTROY` | 再作成可能 |
| Lambda | `DESTROY` | 再デプロイ可能 |
| Cognito User Pool | `RETAIN` | ユーザーデータ喪失防止 |

### 3.3 タグ付け規則

全スタックに以下のタグを付与する（`bin/cdk.ts` の App レベルで設定）:

```typescript
cdk.Tags.of(app).add('Project', 'saborou');
cdk.Tags.of(app).add('ManagedBy', 'aws-cdk');
cdk.Tags.of(app).add('Environment', 'dev');  // 将来: staging / prod
```

---

## 4. CfnOutput 定義

各スタックが出力する `CfnOutput` の一覧:

| スタック | 出力キー | 出力値 |
|---------|---------|--------|
| CognitoStack | `UserPoolId` | Cognito User Pool ID |
| CognitoStack | `UserPoolClientId` | Cognito User Pool Client ID |
| CognitoStack | `CognitoDomainUrl` | Cognito Hosted UI の URL |
| DataStack | `TasksTableName` | DynamoDB Tasks テーブル名 |
| DataStack | `TaskCandidatesTableName` | DynamoDB TaskCandidates テーブル名 |
| ApiStack | `HttpApiUrl` | API Gateway HTTP API エンドポイント URL |
| FrontendStack | `CloudFrontDomainName` | CloudFront ドメイン名 |
| FrontendStack | `S3BucketName` | フロントエンド S3 バケット名 |

---

## 5. ディレクトリ構造（実装後）

```
pkgs/cdk/
├── bin/
│   └── cdk.ts                    # App エントリーポイント（全スタックを登録）
├── lib/
│   ├── stacks/
│   │   ├── cognito-stack.ts      # IN-01: SaborouCognitoStack
│   │   ├── data-stack.ts         # IN-02: SaborouDataStack
│   │   ├── api-stack.ts          # IN-03: SaborouApiStack
│   │   ├── agent-stack.ts        # IN-04: SaborouAgentStack
│   │   ├── webhook-stack.ts      # IN-05: SaborouWebhookStack
│   │   └── frontend-stack.ts     # IN-06: SaborouFrontendStack
│   └── index.ts                  # スタック Props 型定義のエクスポート
├── test/
│   ├── cognito-stack.test.ts
│   ├── data-stack.test.ts
│   ├── api-stack.test.ts
│   ├── agent-stack.test.ts
│   ├── webhook-stack.test.ts
│   └── frontend-stack.test.ts
├── cdk.json
├── package.json
└── tsconfig.json
```

---

## 6. Well-Architected 準拠確認（設計フェーズ）

| 柱 | 設計上の対応 |
|----|------------|
| 運用上の優秀性 | CloudWatch Log Group（14日保持）を全 Lambda に設定。CfnOutput で重要値を出力し運用確認を容易化 |
| セキュリティ | IAM は `grant*()` メソッドで最小権限を付与。Secrets Manager をコードと完全分離。OAC で S3 を非公開 |
| 信頼性 | DLQ（SQS）で失敗イベントを捕捉。DynamoDB RETAIN で誤削除防止 |
| パフォーマンス効率 | ARM64 (Graviton2) を全 Lambda で採用（x86比30%コスト削減・同等性能）|
| コスト最適化 | PAY_PER_REQUEST DynamoDB / Lambda / CloudFront Free Tier 活用。月額 $30.94 見込み |
| 持続可能性 | サーバーレス（ゼロ常時稼働）でアイドル時の電力消費ゼロ |

---

*本ドキュメントは U-02: infra の Functional Design 成果物（v1.0.0）です。*
*6スタックのリソース責務・スタック間 Props 設計・IAM 最小権限設計・環境変数管理方針・RemovalPolicy 設計・タグ付け規則を定義します。*
