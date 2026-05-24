# U-07: google-integration — Infrastructure Design

**バージョン**: 1.1.0
**作成日**: 2026-05-24
**更新日**: 2026-05-24（差分5: ForceDelete・差分2: SOURCE_TYPE定数・Unit分割対応）

---

## 1. インフラ変更方針

U-07 は既存 6 スタックのうち **DataStack** と **ApiStack** の変更のみで完結する。
新スタックの追加は不要（Slack連携と同一 Lambda・同一スタック上に追加）。

---

## 2. DataStack 変更（pkgs/cdk/lib/stacks/data-stack.ts）

### 2.1 追加: GoogleCalendarCache テーブル

```typescript
// data-stack.ts に追加
const googleCalendarCache = new dynamodb.Table(this, "GoogleCalendarCacheTable", {
  ...tableDefaults,
  tableName: `saborou-google-calendar-cache-${environment}`,
  timeToLiveAttribute: "ttl",  // 24h後に自動削除
});
```

### 2.2 追加: Google OAuth client secret

```typescript
// Slack と同一パターン
const googleClientSecret = new secretsmanager.Secret(
  this,
  "GoogleClientSecret",
  {
    secretName: `/saborou/google/client-secret-${environment}`,
    description: "Google OAuth Client ID and Secret",
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  },
);

// dev: cdk destroy 時に即時削除
if (!isProd) {
  new cr.AwsCustomResource(this, "ForceDeleteGoogleClientSecret", {
    onDelete: {
      service: "SecretsManager",
      action: "deleteSecret",
      parameters: {
        SecretId: googleClientSecret.secretArn,
        ForceDeleteWithoutRecovery: true,
      },
      physicalResourceId: cr.PhysicalResourceId.of(googleClientSecret.secretArn),
    },
    policy: cr.AwsCustomResourcePolicy.fromStatements([
      new iam.PolicyStatement({
        actions: ["secretsmanager:DeleteSecret"],
        resources: [googleClientSecret.secretArn],
      }),
    ]),
  });
}
```

### 2.3 DataStackExports 型拡張

```typescript
export interface DataStackExports {
  readonly tables: {
    // 既存7テーブル（変更なし）
    readonly users: dynamodb.Table;
    readonly connections: dynamodb.Table;
    readonly taskCandidates: dynamodb.Table;
    readonly tasks: dynamodb.Table;
    readonly proposals: dynamodb.Table;
    readonly honneData: dynamodb.Table;
    readonly personas: dynamodb.Table;
    // 追加
    readonly googleCalendarCache: dynamodb.Table;
  };
  readonly secrets: {
    readonly slackClientSecret: secretsmanager.Secret;
    readonly slackSigningSecret: secretsmanager.Secret;
    // 追加
    readonly googleClientSecret: secretsmanager.Secret;
  };
}
```

### 2.4 CfnOutput 追加

```typescript
new cdk.CfnOutput(this, "GoogleCalendarCacheTableName", {
  value: googleCalendarCache.tableName,
  description: "DynamoDB Google Calendar Cache Table Name",
});
```

---

## 3. ApiStack 変更（pkgs/cdk/lib/stacks/api-stack.ts）

### 3.1 環境変数追加

```typescript
// honoFn の environment に追加
{
  // 既存の環境変数（変更なし）
  ...existingEnvVars,

  // Google OAuth 追加
  GOOGLE_CLIENT_SECRET_ARN: props.data.secrets.googleClientSecret.secretArn,
  GOOGLE_CLIENT_ID: ssm.StringParameter.valueForStringParameter(
    this,
    "/saborou/google/client-id",
  ),

  // Google CalendarCache テーブル名
  DYNAMODB_TABLE_GOOGLE_CALENDAR_CACHE:
    props.data.tables.googleCalendarCache.tableName,
}
```

### 3.2 DynamoDB 権限追加

```typescript
// Google Calendar Cache テーブルへの読み書き権限
props.data.tables.googleCalendarCache.grantReadWriteData(honoFn);
```

### 3.3 Secrets Manager 権限追加（per-user Googleトークン）

```typescript
// Slack Bot Token と同一パターン

// 読み書き（トークン保存・更新・取得）
honoFn.addToRolePolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    "secretsmanager:GetSecretValue",
    "secretsmanager:PutSecretValue",
    "secretsmanager:UpdateSecret",
    "secretsmanager:DescribeSecret",
    "secretsmanager:DeleteSecret",  // 連携解除時に ForceDelete
  ],
  resources: [
    `arn:aws:secretsmanager:${this.region}:${this.account}:secret:saborou/google-token/*`,
  ],
}));

// Google OAuth client secret の読み取り
props.data.secrets.googleClientSecret.grantRead(honoFn);
```

---

## 4. SSM Parameter Store（手動設定 — CDK管理外）

デプロイ前にオペレーターが以下の SSM パラメータを設定する必要がある。

| パラメータ名 | 値 | 説明 |
|------------|-----|------|
| `/saborou/google/client-id` | Google OAuth Client ID | 公開情報。SSM で環境変数化 |
| `/saborou/google/client-secret-<env>` のARNに対応するSecrets Managerの値 | `{"clientId":"...","clientSecret":"..."}` | コンソールから手動設定 |

**注意**: `/saborou/oauth/state-secret` は Google/Slack 共用の HMAC シークレット。
既存パラメータを再利用するため追加設定は不要。

---

## 5. Google Cloud Console 設定（手動 — デプロイ前に実施）

```
1. Google Cloud Console → APIs & Services → OAuth 2.0 クライアント
2. 承認済みリダイレクト URI に追加:
   https://<API Gateway ID>.execute-api.ap-northeast-1.amazonaws.com/api/auth/google/callback
   （再デプロイのたびにURLが変わる点はSlack同様）

3. 有効にするAPI:
   - Gmail API
   - Google Calendar API

4. OAuth同意画面:
   - スコープ: gmail.readonly, calendar.readonly
   - テストユーザーに自分たちを追加（本番公開前）
```

---

## 6. スタック依存関係（変更なし）

既存の依存関係グラフに変更なし。
DataStack の追加分は ApiStack が Props 経由で参照するだけ。

```
CognitoStack
     |
     v
DataStack -----> ApiStack
     |                |
     v                v
WebhookStack   AgentStack
```

---

## 7. CDK テスト変更点（pkgs/cdk/test/data-stack.test.ts, api-stack.test.ts）

### data-stack.test.ts に追加

```typescript
it("GoogleCalendarCacheTable が TTL 有効で作成される", () => {
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    TableName: Match.stringLikeRegexp("saborou-google-calendar-cache"),
    TimeToLiveSpecification: { Enabled: true, AttributeName: "ttl" },
  });
});

it("GoogleClientSecret が Secrets Manager に作成される", () => {
  template.hasResourceProperties("AWS::SecretsManager::Secret", {
    Name: Match.stringLikeRegexp("/saborou/google/client-secret"),
    Description: "Google OAuth Client ID and Secret",
  });
});
```

### api-stack.test.ts に追加

```typescript
it("HonoFn に GOOGLE_CLIENT_SECRET_ARN 環境変数が設定される", () => {
  template.hasResourceProperties("AWS::Lambda::Function", {
    Environment: {
      Variables: Match.objectLike({
        GOOGLE_CLIENT_SECRET_ARN: Match.anyValue(),
        DYNAMODB_TABLE_GOOGLE_CALENDAR_CACHE: Match.anyValue(),
      }),
    },
  });
});

it("HonoFn が saborou/google-token/* の SM 操作権限を持つ", () => {
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith(["secretsmanager:GetSecretValue"]),
          Resource: Match.arrayWith([Match.stringLikeRegexp("saborou/google-token")]),
        }),
      ]),
    },
  });
});
```

---

## 8. Well-Architected チェック（追加分）

| 柱 | 対応 |
|----|------|
| セキュリティ | refreshToken を Secrets Manager に保管、スコープを readonly に限定、IAM 最小権限 |
| コスト最適化 | 既存 Lambda に追加（新Lambda不要）、DynamoDB TTL で自動削除、PAY_PER_REQUEST |
| 信頼性 | アクセストークン予防的更新 + フォールバックリトライ、CalendarCache 不在時のグレースフル劣化 |
| 運用上の優秀性 | 構造化ログ（PII非含有）、CloudWatch メトリクス継続 |
| パフォーマンス効率 | in-memory トークンキャッシュ、CalendarCache による非同期取り込みとリアルタイム判定の分離 |
