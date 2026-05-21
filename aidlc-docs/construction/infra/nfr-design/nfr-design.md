# NFR 設計パターン — U-02: infra

**Unit**: U-02: infra
**ステージ**: CONSTRUCTION / NFR Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0
**参照**:
- `construction/infra/nfr-requirements/nfr-requirements.md`（NFR-I1〜NFR-I6）
- `construction/infra/functional-design/functional-design.md`（スタック責務定義）
- `inception/application-design/aws-architecture.md`（Well-Architected 準拠）
- `inception/application-design/well-architected-review.md`（改善アクション）

---

## 概要

U-02: infra は AWS CDK v2 (TypeScript) による IaC パッケージである。
本ドキュメントでは以下の NFR 設計パターンを定義する:

1. セキュリティ設計パターン（NFR-I1）
2. コスト最適化設計パターン（NFR-I2）
3. テスト設計パターン（NFR-I3）
4. IaC 再現性設計パターン（NFR-I4）
5. 可観測性設計パターン（NFR-I5）
6. cdk-nag 準拠設計パターン（NFR-I6）

---

## 1. セキュリティ設計パターン（NFR-I1）

### 1.1 最小権限 IAM パターン（Grant Method Pattern）

**目的**: 全 Lambda に対して必要最小限の IAM 権限のみを付与する。

**パターン**: Grant Method Chain パターン

```typescript
// data-stack.ts — テーブルオブジェクトを Props 経由でエクスポート
export interface DataStackExports {
  usersTable: dynamodb.Table;
  connectionsTable: dynamodb.Table;
  taskCandidatesTable: dynamodb.Table;
  tasksTable: dynamodb.Table;
  proposalsTable: dynamodb.Table;
  honneDataTable: dynamodb.Table;
  personasTable: dynamodb.Table;
  slackClientSecret: secretsmanager.Secret;
  slackSigningSecret: secretsmanager.Secret;
  googleClientSecret: secretsmanager.Secret;
}

// api-stack.ts — Props 経由で受け取り grant*() で付与
class SaborouApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    // DynamoDB 権限（全テーブル）
    for (const table of Object.values(props.data.tables)) {
      table.grantReadWriteData(honoFn);
    }
    // Secrets Manager 権限（必要なシークレットのみ）
    props.data.slackClientSecret.grantRead(honoFn);
    props.data.googleClientSecret.grantRead(honoFn);
  }
}
```

**禁止パターン**:
```typescript
// ❌ ワイルドカード IAM Policy Statement は使用しない
honoFn.addToRolePolicy(new iam.PolicyStatement({
  actions: ['dynamodb:*'],
  resources: ['*'],
}));
```

---

### 1.2 Secrets Manager 統合パターン（Secret ARN Injection）

**目的**: シークレット値をコードから完全分離し、Lambda 実行時に Secrets Manager から取得させる。

**パターン**: ARN Injection + Runtime Retrieval パターン

```typescript
// data-stack.ts — Secrets Manager シークレットを CDK で作成（初期値は空）
const slackSigningSecret = new secretsmanager.Secret(this, 'SlackSigningSecret', {
  secretName: '/saborou/slack/signing-secret',
  description: 'Slack Signing Secret for webhook verification',
  removalPolicy: cdk.RemovalPolicy.RETAIN,
  // 初期値はプレースホルダー（実際の値は AWS CLI / Console で設定）
  generateSecretString: {
    secretStringTemplate: JSON.stringify({ placeholder: 'SET_AFTER_DEPLOY' }),
    generateStringKey: 'unused',
  },
});

// webhook-stack.ts — ARN のみを Lambda 環境変数に注入
webhookFn.addEnvironment('SLACK_SIGNING_SECRET_ARN', props.data.slackSigningSecret.secretArn);

// Lambda ランタイム（pkgs/backend 側）— ARN を使って実行時に取得
const secretValue = await secretsManagerClient.send(
  new GetSecretValueCommand({ SecretId: process.env.SLACK_SIGNING_SECRET_ARN })
);
```

**設計上の制約**:
- Lambda 環境変数に機密値（トークン文字列）を直接設定しない
- ARN のみを環境変数に設定し、ランタイムで Secrets Manager から取得

---

### 1.3 CloudFront OAC パターン（S3 非公開配信）

**目的**: S3 バケットをインターネット非公開にしつつ CloudFront 経由でフロントエンドを配信する。

**パターン**: Origin Access Control (OAC) パターン（Legacy OAI の後継）

```typescript
// frontend-stack.ts
const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
  bucketName: `saborou-frontend-${this.account}`,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  encryption: s3.BucketEncryption.S3_MANAGED,
  enforceSSL: true,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,  // cdk destroy 時に自動削除
});

const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
    compress: true,
  },
  defaultRootObject: 'index.html',
  errorResponses: [
    {
      httpStatus: 404,
      responseHttpStatus: 200,
      responsePagePath: '/index.html',
      ttl: cdk.Duration.seconds(0),
    },
    {
      httpStatus: 403,
      responseHttpStatus: 200,
      responsePagePath: '/index.html',
      ttl: cdk.Duration.seconds(0),
    },
  ],
});
```

---

## 2. コスト最適化設計パターン（NFR-I2）

### 2.1 Lambda ARM64 + 適正メモリパターン

**目的**: Graviton2 (ARM64) を使用してコストパフォーマンスを最大化する。

**パターン**: ARM64 Graviton2 Pattern

```typescript
// 全 Lambda で共通の設定ファクトリを使用
function createLambdaFunction(
  scope: Construct,
  id: string,
  props: {
    handler: string;
    codePath: string;
    memorySize: 256 | 512;
    timeout: number;
    environment: Record<string, string>;
  }
): lambda.Function {
  return new lambda.Function(scope, id, {
    runtime: lambda.Runtime.NODEJS_22_X,
    architecture: lambda.Architecture.ARM_64,  // Graviton2: x86比30%コスト削減
    handler: props.handler,
    code: lambda.Code.fromAsset(props.codePath),
    memorySize: props.memorySize,
    timeout: cdk.Duration.seconds(props.timeout),
    environment: props.environment,
    logGroup: new logs.LogGroup(scope, `${id}LogGroup`, {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    }),
    tracing: lambda.Tracing.ACTIVE,  // X-Ray トレーシング有効化
  });
}
```

**Lambda メモリ・タイムアウト設定一覧（コスト・性能トレードオフ最適化済み）**:

| Lambda | Memory | Timeout | 月額推定（10K invocations）|
|--------|--------|---------|--------------------------|
| Hono API | 256 MB | 29秒 | $0.50 |
| TaskExtractor | 512 MB | 60秒 | $0.30 |
| SaboriProposer | 512 MB | 60秒 | $0.20 |
| Webhook Handler | 256 MB | 10秒 | $0.05 |

---

### 2.2 DynamoDB PAY_PER_REQUEST パターン

**目的**: ハッカソン規模のトラフィックに対してコストを最小化する。

```typescript
// data-stack.ts — 全テーブル共通設定
const tableDefaults = {
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },  // コスト削減のため無効（ハッカソンスコープ）
  removalPolicy: cdk.RemovalPolicy.RETAIN,
};
```

---

### 2.3 CloudWatch ログ保持コスト最適化パターン

```typescript
// 全 Lambda Log Group — 14日保持（デフォルト Never より大幅コスト削減）
new logs.LogGroup(scope, `${id}LogGroup`, {
  logGroupName: `/aws/lambda/${functionName}`,
  retention: logs.RetentionDays.TWO_WEEKS,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

---

## 3. テスト設計パターン（NFR-I3）

### 3.1 CDK Assertions ファイングレインドテストパターン

**目的**: 各スタックの重要なリソース設定を自動テストで検証する。

**パターン**: Template Assertion Pattern

```typescript
// test/data-stack.test.ts — 例
import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { SaborouDataStack } from '../lib/stacks/data-stack';

describe('SaborouDataStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const stack = new SaborouDataStack(app, 'TestDataStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
    });
    template = Template.fromStack(stack);
  });

  test('DynamoDB テーブルが PAY_PER_REQUEST で作成されること', () => {
    template.resourceCountIs('AWS::DynamoDB::Table', 7);
    template.allResourcesProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  test('TaskCandidates テーブルに GSI-UserCreatedAt が設定されること', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'GSI-UserCreatedAt',
        }),
      ]),
    });
  });

  test('TaskCandidates テーブルに TTL が有効化されること', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true,
      },
    });
  });
});
```

**テストファイル一覧とカバー範囲**:

| テストファイル | 検証項目 |
|-------------|---------|
| `cognito-stack.test.ts` | User Pool 自己サインアップ無効 / Client OAuth フロー |
| `data-stack.test.ts` | DynamoDB × 7テーブル / GSI 設定 / TTL 設定 / Secrets Manager |
| `api-stack.test.ts` | Lambda ARM64 / 256MB / JWT オーソライザー / CORS |
| `agent-stack.test.ts` | Lambda ARM64 / 512MB / DLQ 設定 / Bedrock IAM |
| `webhook-stack.test.ts` | EventBridge Bus/Rule / Scheduler / Webhook Lambda |
| `frontend-stack.test.ts` | S3 BlockPublicAccess / CloudFront HTTPS / SPA フォールバック |

---

## 4. IaC 再現性設計パターン（NFR-I4）

### 4.1 環境設定分離パターン（Context-Based Config）

**目的**: 環境（dev/prod）の差分を CDK コンテキストで管理し、コードの変更なしに切り替える。

```typescript
// bin/cdk.ts
const app = new cdk.App();

const environment = app.node.tryGetContext('environment') ?? 'dev';
const isDev = environment === 'dev';

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ap-northeast-1',  // 固定（aws-constraints.md）
};

// タグをアプリ全体に付与
cdk.Tags.of(app).add('Project', 'saborou');
cdk.Tags.of(app).add('ManagedBy', 'aws-cdk');
cdk.Tags.of(app).add('Environment', environment);

// スタックを依存順序で登録
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
```

### 4.2 cdk.context.json 管理パターン

```
# .gitignore には cdk.context.json を含めない（必ずコミットする）
# cdk.context.json は synthesize 時に自動生成される非決定的な値を記録する
# → リポジトリにコミットすることで synth を決定的にする
```

---

## 5. 可観測性設計パターン（NFR-I5）

### 5.1 CloudWatch アラーム自動生成パターン

**目的**: CDK でアラームを自動定義し、手動設定漏れを防止する。

```typescript
// monitoring-construct.ts（共通コンストラクト）
export class SaborouMonitoring extends Construct {
  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    // SNS トピック（メール通知）
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: 'Saborou Alarms',
    });

    // Lambda Duration アラーム（共通ファクトリ）
    const createDurationAlarm = (
      fn: lambda.Function,
      thresholdSeconds: number,
      name: string
    ) => {
      fn.metricDuration({ statistic: 'p99' }).createAlarm(scope, name, {
        threshold: thresholdSeconds * 1000,  // ミリ秒換算
        evaluationPeriods: 2,
        alarmDescription: `${fn.functionName} P99 Duration > ${thresholdSeconds}s`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }).addAlarmAction(new cwActions.SnsAction(alarmTopic));
    };

    createDurationAlarm(props.taskExtractorFn, 60, 'SaborouAlarm-TaskExtractorTimeout');
    createDurationAlarm(props.saboriProposerFn, 60, 'SaborouAlarm-SaboriProposerTimeout');
    createDurationAlarm(props.honoFn, 29, 'SaborouAlarm-ApiTimeout');

    // Lambda 同時実行数アラーム（アカウント全体）
    new cloudwatch.Alarm(this, 'ConcurrentExecutionsAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'ConcurrentExecutions',
        statistic: 'Maximum',
      }),
      threshold: 100,
      evaluationPeriods: 1,
      alarmName: 'SaborouAlarm-ConcurrentExecutions',
    }).addAlarmAction(new cwActions.SnsAction(alarmTopic));
  }
}
```

### 5.2 X-Ray トレーシング有効化パターン

```typescript
// 全 Lambda で tracing: lambda.Tracing.ACTIVE を設定
// API Gateway でも X-Ray トレーシングを有効化
const httpApi = new apigatewayv2.HttpApi(this, 'SaborouApi', {
  // ...
});
// HTTP API v2 は CDK で直接 X-Ray 設定不可のため CfnStage で設定
const cfnStage = httpApi.defaultStage?.node.defaultChild as apigatewayv2.CfnStage;
if (cfnStage) {
  cfnStage.accessLogSettings = {
    destinationArn: logGroup.logGroupArn,
  };
}
```

---

## 6. cdk-nag 準拠設計パターン（NFR-I6）

### 6.1 AwsSolutionsChecks 適用パターン

```typescript
// bin/cdk.ts — App レベルで有効化
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { Aspects } from 'aws-cdk-lib';

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
```

### 6.2 許容される違反の明示的抑制パターン

ハッカソンスコープで許容される cdk-nag 違反を事前に定義し、理由を必ず記録する:

```typescript
// ハッカソンスコープで許容する違反一覧
const nagSuppressions = [
  {
    id: 'AwsSolutions-DDB3',
    reason: 'Point-in-time recovery は本番環境で必要。ハッカソンスコープではコスト削減のため無効化。',
  },
  {
    id: 'AwsSolutions-COG2',
    reason: 'MFA は本番環境で推奨。ハッカソンデモ環境では UX 優先のため無効化。',
  },
  {
    id: 'AwsSolutions-SMG4',
    reason: 'Secrets Manager ローテーションは本番環境で必要。ハッカソン期間中は手動管理。',
  },
];
```

---

## NFR 設計サマリ

| NFR ID | 設計パターン | 適用ファイル |
|--------|------------|------------|
| NFR-I1a | Grant Method Chain パターン | 全スタック |
| NFR-I1b | ARN Injection + Runtime Retrieval パターン | data-stack.ts / webhook-stack.ts / agent-stack.ts |
| NFR-I1c | CloudFront OAC パターン | frontend-stack.ts |
| NFR-I2a | ARM64 Graviton2 + 適正メモリパターン | api-stack.ts / agent-stack.ts / webhook-stack.ts |
| NFR-I2b | DynamoDB PAY_PER_REQUEST パターン | data-stack.ts |
| NFR-I2c | Log Retention 14日パターン | 全スタック（Lambda Log Group）|
| NFR-I3a | CDK Template Assertion パターン | test/*.test.ts（6ファイル）|
| NFR-I3b | CDK Synth CI 検証パターン | package.json scripts |
| NFR-I4a | Context-Based Config パターン | bin/cdk.ts |
| NFR-I4b | cdk.context.json コミットパターン | .gitignore 除外 |
| NFR-I5a | CloudWatch アラーム自動生成パターン | monitoring-construct.ts（新規）|
| NFR-I5b | X-Ray トレーシング有効化パターン | 全 Lambda / api-stack.ts |
| NFR-I6 | AwsSolutionsChecks + 明示的抑制パターン | bin/cdk.ts |

---

*本ドキュメントは U-02: infra の NFR Design 成果物（v1.0.0）です。*
*セキュリティ・コスト・テスト・IaC 再現性・可観測性・cdk-nag 準拠の設計パターンを定義します。*
