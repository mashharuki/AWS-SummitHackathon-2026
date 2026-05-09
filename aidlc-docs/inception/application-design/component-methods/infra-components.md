# infra-components — コンポーネントメソッド定義

**パッケージ**: infra/（AWS CDK TypeScript）  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § IN-01〜IN-06  
**AWSアーキテクチャ詳細**: [aws-architecture.md](../aws-architecture.md)

---

## CDK スタック一覧

| スタック | クラス名 | 主な AWS リソース |
|---------|----------|-----------------|
| IN-01 CognitoStack | `CognitoStack extends cdk.Stack` | User Pool, User Pool Client, Google IdP, Domain |
| IN-02 DataStack | `DataStack extends cdk.Stack` | DynamoDB テーブル 7 本（On-Demand） |
| IN-03 ApiStack | `ApiStack extends cdk.Stack` | API Gateway HTTP API, Hono Lambda, オーソライザー |
| IN-04 AgentStack | `AgentStack extends cdk.Stack` | Bedrock AgentCore, TaskExtractor Lambda, EventBridge |
| IN-05 WebhookStack | `WebhookStack extends cdk.Stack` | Slack/Gmail Webhook Lambda |
| IN-06 FrontendStack | `FrontendStack extends cdk.Stack` | S3 バケット, CloudFront ディストリビューション |

---

## IN-01: CognitoStack

```typescript
class CognitoStack extends cdk.Stack {
  readonly userPool: cognito.UserPool
  readonly userPoolClient: cognito.UserPoolClient
  readonly userPoolDomain: cognito.UserPoolDomain

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,        // 管理者のみユーザー作成可（ハッカソン期間中）
      signInAliases: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
    })

    // Google IdP (OpenID Connect)
    new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdP', {
      userPool: this.userPool,
      clientId: ssm.StringParameter.valueForStringParameter(this, '/saborou/google/clientId'),
      clientSecretValue: secretsManager.Secret.fromSecretNameV2(
        this, 'GoogleSecret', '/saborou/google/clientSecret'
      ).secretValue,
      scopes: ['openid', 'email', 'profile'],
    })

    this.userPoolClient = this.userPool.addClient('WebClient', {
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: ['https://saborou.example.com/auth/callback'],
        logoutUrls: ['https://saborou.example.com'],
      },
    })

    this.userPoolDomain = this.userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: 'saborou-auth' },
    })
  }
}
```

---

## IN-02: DataStack

```typescript
class DataStack extends cdk.Stack {
  readonly tasksTable: dynamodb.Table
  readonly taskCandidatesTable: dynamodb.Table
  readonly proposalsTable: dynamodb.Table
  readonly honneDataTable: dynamodb.Table
  readonly usersTable: dynamodb.Table
  readonly connectionsTable: dynamodb.Table
  readonly personasTable: dynamodb.Table

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    // 全テーブルは On-Demand（PAY_PER_REQUEST）
    // 全テーブルは PK: userId（tenant isolation）
    // SK はテーブルによって異なる（詳細: components.md § SH-01 型定義）
    ...
  }
}
```

**DynamoDB テーブル設計**: [components.md](../components.md) § SH-01 を参照。

---

## IN-03: ApiStack

```typescript
class ApiStack extends cdk.Stack {
  readonly httpApi: apigatewayv2.HttpApi

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    // Hono on Lambda（ARM64 / Node.js 22）
    const honoFunction = new lambda.Function(this, 'HonoFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      environment: {
        COGNITO_USER_POOL_ID: props.userPool.userPoolId,
        DYNAMODB_TABLE_PREFIX: 'saborou-',
      },
    })

    // JWT オーソライザー（Cognito）
    const authorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      props.userPoolDomain.baseUrl(),
      { jwtAudience: [props.userPoolClient.userPoolClientId] }
    )

    this.httpApi = new apigatewayv2.HttpApi(this, 'SaborouApi', {
      corsPreflight: {
        allowOrigins: ['https://saborou.example.com'],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    })
  }
}
```

---

## IN-06: FrontendStack

```typescript
class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    // S3 バケット（Orign Access Identity で CloudFront 経由のみ公開）
    const bucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    })

    // CloudFront ディストリビューション
    new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new cloudfrontOrigins.S3Origin(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      // SPA 対応: すべての 404 を /index.html にフォールバック
      errorResponses: [{
        httpStatus: 404,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
      }],
    })
  }
}
```

---

## スタック間の依存関係

```
CognitoStack
    ↓ (userPool, userPoolClient)
ApiStack ← DataStack (DynamoDB テーブル ARN)
    ↓ (httpApiUrl)
AgentStack
    ↓
WebhookStack
FrontendStack (独立)
```

詳細: [unit-dependencies.md](../../units/unit-dependencies.md) / [aws-architecture.md](../aws-architecture.md) § CDK スタック依存関係図

---

## 関連要件

- NFR-04: AWS Well-Architected（最小権限 IAM / HTTPS 強制）
- NFR-05: IaC による再現可能なデプロイ（CDK TypeScript）
- NFR-06: コスト最適化（On-Demand DynamoDB / Lambda / CloudFront Free Tier）
