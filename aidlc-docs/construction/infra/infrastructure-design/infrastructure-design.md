# Infrastructure Design — U-02: infra

**Unit**: U-02: infra
**ステージ**: CONSTRUCTION / Infrastructure Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0
**参照**:
- `construction/infra/functional-design/functional-design.md`
- `construction/infra/nfr-requirements/nfr-requirements.md`
- `construction/infra/nfr-design/nfr-design.md`
- `inception/application-design/aws-architecture.md`
- `inception/application-design/dynamodb-access-patterns.md`
- `.claude/rules/aws-constraints.md`（ap-northeast-1 / サーバーレス優先）

---

## 概要

本ドキュメントは U-02: infra（`pkgs/cdk/`）のコード生成フェーズで直接参照する詳細仕様書である。
CDK スタック 6 本・テストファイル 6 本・設定ファイルの完全な実装仕様を記載する。

---

## 1. 依存パッケージ仕様

### 1.1 package.json（既存から更新）

追加が必要な依存パッケージ:

```json
{
  "dependencies": {
    "aws-cdk-lib": "2.232.1",       // 既存（変更不要）
    "constructs": "^10.0.0",         // 既存（変更不要）
    "cdk-nag": "^2.35.0"            // 追加（NFR-I6）
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",      // 既存
    "@types/node": "^24.10.1",      // 既存
    "jest": "^29.7.0",              // 既存
    "ts-jest": "^29.2.5",           // 既存
    "aws-cdk": "2.1100.1",          // 既存
    "ts-node": "^10.9.2",           // 既存
    "typescript": "~5.9.3"          // 既存
  }
}
```

### 1.2 tsconfig.json（更新）

既存の `module: "NodeNext"` は ts-node との相性に注意が必要。CDK のエントリーポイント実行には CommonJS モジュールが適切:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",       // NodeNext から変更（ts-node との互換性）
    "moduleResolution": "node", // NodeNext から変更
    "lib": ["es2022"],
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": false,
    "inlineSourceMap": true,
    "inlineSources": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false,
    "skipLibCheck": true,
    "typeRoots": ["./node_modules/@types"],
    "outDir": "dist"
  },
  "exclude": ["node_modules", "cdk.out"]
}
```

---

## 2. ファイル構成と実装仕様

### 2.1 `bin/cdk.ts`（エントリーポイント）

**役割**: 全スタックを App に登録し、タグ付け・cdk-nag 適用を行う。

**実装仕様**:
```typescript
#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { SaborouCognitoStack } from '../lib/stacks/cognito-stack';
import { SaborouDataStack } from '../lib/stacks/data-stack';
import { SaborouApiStack } from '../lib/stacks/api-stack';
import { SaborouAgentStack } from '../lib/stacks/agent-stack';
import { SaborouWebhookStack } from '../lib/stacks/webhook-stack';
import { SaborouFrontendStack } from '../lib/stacks/frontend-stack';

const app = new cdk.App();
const environment = app.node.tryGetContext('environment') ?? 'dev';

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ap-northeast-1',
};

// アプリ全体タグ
cdk.Tags.of(app).add('Project', 'saborou');
cdk.Tags.of(app).add('ManagedBy', 'aws-cdk');
cdk.Tags.of(app).add('Environment', environment);

// スタック定義（依存順序）
const cognitoStack = new SaborouCognitoStack(app, `SaborouCognito-${environment}`, { env });
const dataStack = new SaborouDataStack(app, `SaborouData-${environment}`, { env });
const apiStack = new SaborouApiStack(app, `SaborouApi-${environment}`, {
  env,
  cognito: cognitoStack.exports,
  data: dataStack.exports,
});
const agentStack = new SaborouAgentStack(app, `SaborouAgent-${environment}`, {
  env,
  data: dataStack.exports,
});
const webhookStack = new SaborouWebhookStack(app, `SaborouWebhook-${environment}`, {
  env,
  data: dataStack.exports,
  agents: agentStack.exports,
});
new SaborouFrontendStack(app, `SaborouFrontend-${environment}`, {
  env,
  apiUrl: apiStack.exports.httpApiUrl,
});

// cdk-nag（AwsSolutionsChecks 適用）
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
```

---

### 2.2 `lib/stacks/cognito-stack.ts`（IN-01）

**Props**: `cdk.StackProps`
**Exports**: `userPool`, `userPoolClient`, `userPoolDomain`

**主要リソース詳細仕様**:

| リソース | プロパティ | 値 |
|---------|-----------|-----|
| UserPool | `selfSignUpEnabled` | `false` |
| UserPool | `signInAliases` | `{ email: true }` |
| UserPool | `mfa` | `cognito.Mfa.OFF`（デモ環境）|
| UserPool | `passwordPolicy` | minLength: 8, requireLowercase: true, requireDigits: true |
| UserPool | `removalPolicy` | `RETAIN` |
| UserPool | `deletionProtection` | `false`（ハッカソンスコープ）|
| Google IdP | `clientId` | `ssm.StringParameter.valueForStringParameter(this, '/saborou/google/client-id')` |
| Google IdP | `clientSecretValue` | `secretsmanager.Secret.fromSecretNameV2(this, 'GoogleSecret', '/saborou/google/client-secret').secretValue` |
| Google IdP | `scopes` | `['openid', 'email', 'profile']` |
| UserPoolClient | `oAuth.flows` | `{ authorizationCodeGrant: true }` |
| UserPoolClient | `oAuth.callbackUrls` | CloudFront URL + `/auth/callback`（CfnOutput 参照）|
| UserPoolClient | `oAuth.logoutUrls` | CloudFront URL（CfnOutput 参照）|
| UserPoolClient | `supportedIdentityProviders` | `[cognito.UserPoolClientIdentityProvider.GOOGLE]` |
| CognitoDomain | `domainPrefix` | `saborou-auth-${environment}` |

**cdk-nag 抑制**:
- `AwsSolutions-COG2`: MFA 無効化（ハッカソンデモ環境）
- `AwsSolutions-COG3`: AdvancedSecurityMode 無効（コスト削減）

---

### 2.3 `lib/stacks/data-stack.ts`（IN-02）

**Props**: `cdk.StackProps`
**Exports**: `tables`（7テーブル）、`secrets`（3シークレット）、`parameters`（2 SSM パラメータ）

**DynamoDB テーブル完全仕様**:

```typescript
// テーブル共通設定
const tableDefaults: Partial<dynamodb.TableProps> = {
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
};

// 各テーブル仕様
const tables = {
  users: new dynamodb.Table(this, 'UsersTable', {
    ...tableDefaults,
    tableName: `saborou-users-${environment}`,
    partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  }),

  connections: new dynamodb.Table(this, 'ConnectionsTable', {
    ...tableDefaults,
    tableName: `saborou-service-connections-${environment}`,
    partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  }),

  taskCandidates: new dynamodb.Table(this, 'TaskCandidatesTable', {
    ...tableDefaults,
    tableName: `saborou-task-candidates-${environment}`,
    partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
    timeToLiveAttribute: 'ttl',  // 30日 TTL
  }),

  tasks: new dynamodb.Table(this, 'TasksTable', {
    ...tableDefaults,
    tableName: `saborou-tasks-${environment}`,
    partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  }),

  proposals: new dynamodb.Table(this, 'ProposalsTable', {
    ...tableDefaults,
    tableName: `saborou-proposals-${environment}`,
    partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  }),

  honneData: new dynamodb.Table(this, 'HonneDataTable', {
    ...tableDefaults,
    tableName: `saborou-honne-data-${environment}`,
    partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  }),

  personas: new dynamodb.Table(this, 'PersonasTable', {
    ...tableDefaults,
    tableName: `saborou-personas-${environment}`,
    partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  }),
};

// GSI 追加
tables.taskCandidates.addGlobalSecondaryIndex({
  indexName: 'GSI-UserCreatedAt',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

tables.tasks.addGlobalSecondaryIndex({
  indexName: 'GSI-UserStatus',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

tables.proposals.addGlobalSecondaryIndex({
  indexName: 'GSI-TaskLatest',
  partitionKey: { name: 'taskId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'evaluatedAt', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

tables.honneData.addGlobalSecondaryIndex({
  indexName: 'GSI-UserCreatedAt',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

**Secrets Manager シークレット仕様**:

```typescript
const secrets = {
  slackClientSecret: new secretsmanager.Secret(this, 'SlackClientSecret', {
    secretName: `/saborou/slack/client-secret-${environment}`,
    description: 'Slack OAuth Client Secret',
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  }),
  slackSigningSecret: new secretsmanager.Secret(this, 'SlackSigningSecret', {
    secretName: `/saborou/slack/signing-secret-${environment}`,
    description: 'Slack Signing Secret for webhook verification',
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  }),
  googleClientSecret: new secretsmanager.Secret(this, 'GoogleClientSecret', {
    secretName: `/saborou/google/client-secret-${environment}`,
    description: 'Google OAuth Client Secret',
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  }),
};
```

**cdk-nag 抑制**:
- `AwsSolutions-DDB3`: PITRなし（コスト削減・ハッカソンスコープ）
- `AwsSolutions-SMG4`: シークレットローテーションなし（手動管理・ハッカソンスコープ）

---

### 2.4 `lib/stacks/api-stack.ts`（IN-03）

**Props**: `cognito: CognitoStackExports`, `data: DataStackExports`
**Exports**: `httpApiUrl`, `honoFn`

**Lambda 仕様**:
- Runtime: `nodejs22.x` / Architecture: `ARM_64`
- Memory: 256 MB / Timeout: 29秒
- Code: `lambda.Code.fromAsset('../../pkgs/backend/dist')`（ビルド済み成果物）
- Handler: `index.handler`

**API Gateway HTTP API 仕様**:
- CORS allowOrigins: CloudFront ドメイン（`https://${props.cloudfrontDomain}`）
- CORS allowMethods: `[CorsHttpMethod.ANY]`
- CORS allowHeaders: `['Authorization', 'Content-Type', 'X-Requested-With']`
- ルート: `ANY /{proxy+}` → Hono Lambda（JWT オーソライザー付き）
- ヘルスチェックルート: `GET /health` → 認証なし

**JWT オーソライザー仕様**:
```typescript
const authorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
  'CognitoAuthorizer',
  `https://cognito-idp.ap-northeast-1.amazonaws.com/${props.cognito.userPool.userPoolId}`,
  {
    jwtAudience: [props.cognito.userPoolClient.userPoolClientId],
    authorizerName: 'CognitoJwtAuthorizer',
    identitySource: ['$request.header.Authorization'],
  }
);
```

---

### 2.5 `lib/stacks/agent-stack.ts`（IN-04）

**Props**: `data: DataStackExports`
**Exports**: `taskExtractorFn`, `saboriProposerFn`

**Bedrock IAM Policy Statement**（共通）:
```typescript
const bedrockPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    'bedrock:InvokeModel',
    'bedrock:InvokeModelWithResponseStream',
  ],
  resources: [
    `arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
    `arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0`,
  ],
});
```

**TaskExtractor Lambda 仕様**:
- Memory: 512 MB / Timeout: 60秒
- DLQ: `sqs.Queue`（保持期間 1日）
- IAM: `taskCandidatesTable.grantReadWriteData()` + `tasksTable.grantReadData()` + Bedrock Policy

**SaboriProposer Lambda 仕様**:
- Memory: 512 MB / Timeout: 60秒
- DLQ: `sqs.Queue`（保持期間 1日）
- IAM: `proposalsTable.grantReadWriteData()` + `tasksTable.grantReadData()` + `personasTable.grantReadData()` + `slackClientSecret.grantRead()` + Bedrock Policy

**cdk-nag 抑制**:
- `AwsSolutions-SQS3`: DLQ に DLQ なし（DLQ 自体に DLQ は不要）

---

### 2.6 `lib/stacks/webhook-stack.ts`（IN-05）

**Props**: `data: DataStackExports`, `agents: AgentStackExports`
**Exports**: `eventBus`

**EventBridge カスタムバス仕様**:
```typescript
const eventBus = new events.EventBus(this, 'SaborouEventBus', {
  eventBusName: `saborou-event-bus-${environment}`,
});
```

**EventBridge ルール（Slack → TaskExtractor）**:
```typescript
new events.Rule(this, 'SlackToTaskExtractorRule', {
  eventBus,
  eventPattern: {
    source: ['saborou.webhook'],
    detailType: ['SlackEvent'],
  },
  targets: [new eventsTargets.LambdaFunction(props.agents.taskExtractorFn, {
    deadLetterQueue: new sqs.Queue(this, 'RuleDlq', {
      retentionPeriod: cdk.Duration.days(1),
    }),
    retryAttempts: 3,
  })],
});
```

**EventBridge Scheduler（バックグラウンド再評価）**:
```typescript
const schedulerRole = new iam.Role(this, 'SchedulerRole', {
  assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
});
props.agents.saboriProposerFn.grantInvoke(schedulerRole);

new scheduler.CfnSchedule(this, 'BackgroundRefreshSchedule', {
  scheduleExpression: 'rate(1 hour)',
  flexibleTimeWindow: { mode: 'OFF' },
  target: {
    arn: props.agents.saboriProposerFn.functionArn,
    roleArn: schedulerRole.roleArn,
    input: JSON.stringify({ source: 'scheduler', type: 'background_refresh' }),
  },
  name: `saborou-background-refresh-${environment}`,
  state: 'ENABLED',
});
```

**Webhook Lambda 仕様**:
- Memory: 256 MB / Timeout: 10秒
- IAM: `eventBus.grantPutEventsTo()` + `slackSigningSecret.grantRead()`

---

### 2.7 `lib/stacks/frontend-stack.ts`（IN-06）

**Props**: `apiUrl: string`
**Exports**: `distributionDomainName`, `bucketName`

**S3 バケット仕様**:
```typescript
const bucket = new s3.Bucket(this, 'FrontendBucket', {
  bucketName: `saborou-frontend-${this.account}-${environment}`,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  encryption: s3.BucketEncryption.S3_MANAGED,
  enforceSSL: true,
  versioned: false,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});
```

**CloudFront Distribution 仕様**:
```typescript
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
    compress: true,
  },
  defaultRootObject: 'index.html',
  errorResponses: [
    { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
    { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
  ],
  priceClass: cloudfront.PriceClass.PRICE_CLASS_200,  // 日本含むリージョン
  comment: `Saborou Frontend Distribution (${environment})`,
  enableLogging: false,  // コスト削減のため無効（ハッカソンスコープ）
});
```

**cdk-nag 抑制**:
- `AwsSolutions-CFR1`: CloudFront ログ無効（コスト削減）
- `AwsSolutions-CFR4`: TLS 1.2 ポリシーは自動適用のため問題なし

---

### 2.8 `lib/stacks/monitoring-construct.ts`（共通コンストラクト）

新規ファイルとして作成。CloudWatch アラーム + Dashboard の自動生成。

**組み込みスタック**: `SaborouApiStack` に統合する（スタック追加を避けてシンプルに保つ）。

---

## 3. テストファイル仕様

### 3.1 テストファイル一覧

| ファイル | 検証項目数 | 優先度 |
|---------|-----------|--------|
| `test/data-stack.test.ts` | 8 | 最高（データ整合性）|
| `test/cognito-stack.test.ts` | 5 | 高（認証）|
| `test/api-stack.test.ts` | 6 | 高（API）|
| `test/agent-stack.test.ts` | 5 | 高（AI エージェント）|
| `test/webhook-stack.test.ts` | 4 | 中（EventBridge）|
| `test/frontend-stack.test.ts` | 5 | 中（CloudFront）|

### 3.2 jest.config.js 更新

```js
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  collectCoverageFrom: ['lib/**/*.ts'],
  coverageThreshold: {
    global: { lines: 70, branches: 60, functions: 80 }  // CDK スタックはビジネスロジック少のため低め
  },
};
```

---

## 4. デプロイ仕様

### 4.1 デプロイ前準備

```bash
# 1. AWS CLI 認証確認
aws sts get-caller-identity

# 2. CDK Bootstrap（初回のみ）
pnpm --filter cdk cdk bootstrap aws://ACCOUNT_ID/ap-northeast-1

# 3. Secrets Manager 初期値設定（初回のみ）
aws secretsmanager put-secret-value \
  --secret-id /saborou/slack/signing-secret-dev \
  --secret-string '{"value":"YOUR_SLACK_SIGNING_SECRET"}'

aws secretsmanager put-secret-value \
  --secret-id /saborou/slack/client-secret-dev \
  --secret-string '{"value":"YOUR_SLACK_CLIENT_SECRET"}'

aws secretsmanager put-secret-value \
  --secret-id /saborou/google/client-secret-dev \
  --secret-string '{"value":"YOUR_GOOGLE_CLIENT_SECRET"}'

# 4. SSM Parameter Store 初期値設定
aws ssm put-parameter --name /saborou/google/client-id \
  --value "YOUR_GOOGLE_CLIENT_ID" --type String

aws ssm put-parameter --name /saborou/slack/client-id \
  --value "YOUR_SLACK_CLIENT_ID" --type String
```

### 4.2 デプロイ順序

```bash
# CDK Synth（テンプレート生成・cdk-nag チェック）
pnpm --filter cdk synth

# スタック順次デプロイ（依存関係順）
pnpm --filter cdk cdk deploy SaborouCognito-dev --require-approval never
pnpm --filter cdk cdk deploy SaborouData-dev --require-approval never
pnpm --filter cdk cdk deploy SaborouApi-dev --require-approval never
pnpm --filter cdk cdk deploy SaborouAgent-dev --require-approval never
pnpm --filter cdk cdk deploy SaborouWebhook-dev --require-approval never
pnpm --filter cdk cdk deploy SaborouFrontend-dev --require-approval never

# または全スタック一括デプロイ
pnpm --filter cdk cdk deploy --all --require-approval never
```

### 4.3 CfnOutput 一覧

デプロイ完了後に以下の値を確認する:

| スタック | 出力キー | 用途 |
|---------|---------|------|
| SaborouCognito-dev | `UserPoolId` | フロントエンド環境変数 `VITE_COGNITO_USER_POOL_ID` |
| SaborouCognito-dev | `UserPoolClientId` | フロントエンド環境変数 `VITE_COGNITO_CLIENT_ID` |
| SaborouCognito-dev | `CognitoDomainUrl` | Cognito Hosted UI URL（OAuthフロー開始 URL）|
| SaborouData-dev | `TasksTableName` | バックエンド環境変数 `DYNAMODB_TABLE_TASKS` |
| SaborouApi-dev | `HttpApiUrl` | フロントエンド環境変数 `VITE_API_BASE_URL` |
| SaborouFrontend-dev | `CloudFrontDomainName` | Cognito コールバック URL 設定用 |
| SaborouFrontend-dev | `S3BucketName` | フロントエンドビルド成果物のデプロイ先 |

---

## 5. Well-Architected 準拠最終確認

| 柱 | 実装項目 | 対応スタック |
|----|---------|------------|
| 運用上の優秀性 | CloudWatch Log Group（全Lambda・14日保持）/ CloudWatch Alarms（5項目）/ CloudWatch Dashboard / X-Ray トレーシング | 全スタック・monitoring-construct |
| セキュリティ | IAM 最小権限（`grant*()` のみ）/ OAC（S3 非公開）/ Secrets Manager 分離 / Cognito JWT オーソライザー / cdk-nag 通過 | 全スタック |
| 信頼性 | DynamoDB RETAIN / Cognito RETAIN / DLQ（TaskExtractor・SaboriProposer）/ EventBridge リトライ（3回）| data-stack / cognito-stack / agent-stack / webhook-stack |
| パフォーマンス効率 | ARM64 Graviton2（全Lambda）/ Lambda 適正メモリ設定 / CloudFront Compress 有効 | api-stack / agent-stack / webhook-stack / frontend-stack |
| コスト最適化 | PAY_PER_REQUEST DynamoDB / Lambda サーバーレス / CloudFront 日本向けプライスクラス / ログ14日保持 | data-stack / api-stack / frontend-stack |
| 持続可能性 | サーバーレス全体構成（ゼロ常時稼働）/ ARM64 消費電力削減 | 全スタック |

---

*本ドキュメントは U-02: infra の Infrastructure Design 成果物（v1.0.0）です。*
*6スタックの詳細実装仕様・テストファイル仕様・デプロイ手順・CfnOutput 一覧を定義します。*
*Code Generation フェーズでは本ドキュメントを直接参照して実装を進めてください。*
