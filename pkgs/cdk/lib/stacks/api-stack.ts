import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2Authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as apigatewayv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { NagSuppressions } from "cdk-nag";
import type { Construct } from "constructs";
import type { CognitoStackExports } from "./cognito-stack";
import type { DataStackExports } from "./data-stack";

export interface ApiStackProps extends cdk.StackProps {
  readonly cognito: CognitoStackExports;
  readonly data: DataStackExports;
  readonly frontendDomainName?: string;
}

export interface ApiStackExports {
  readonly httpApiUrl: string;
  readonly honoFn: lambda.Function;
}

export class SaborouApiStack extends cdk.Stack {
  public readonly exports: ApiStackExports;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext("environment") ?? "dev";

    // --- Lambda: Hono バックエンド ---
    const honoFnLogGroup = new logs.LogGroup(this, "HonoFnLogGroup", {
      logGroupName: `/aws/lambda/saborou-api-${environment}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const honoFn = new lambda.Function(this, "HonoFn", {
      functionName: `saborou-api-${environment}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(29),
      handler: "index.handler",
      code: lambda.Code.fromAsset("../../pkgs/backend/dist"),
      logGroup: honoFnLogGroup,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        ENVIRONMENT: environment,
        // --- Cognito (追加: U-04 認証/Slack コールバックで必要) ---
        COGNITO_USER_POOL_ID: props.cognito.userPool.userPoolId,
        COGNITO_CLIENT_ID: props.cognito.userPoolClient.userPoolClientId,
        // --- DynamoDB テーブル ---
        DYNAMODB_TABLE_USERS: props.data.tables.users.tableName,
        DYNAMODB_TABLE_CONNECTIONS: props.data.tables.connections.tableName,
        DYNAMODB_TABLE_TASK_CANDIDATES:
          props.data.tables.taskCandidates.tableName,
        DYNAMODB_TABLE_TASKS: props.data.tables.tasks.tableName,
        DYNAMODB_TABLE_PROPOSALS: props.data.tables.proposals.tableName,
        DYNAMODB_TABLE_HONNE_DATA: props.data.tables.honneData.tableName,
        DYNAMODB_TABLE_PERSONAS: props.data.tables.personas.tableName,
        // --- シークレット (追加: U-04 Slack OAuth コールバックがクライアントシークレットを使用) ---
        SLACK_CLIENT_SECRET_ARN: props.data.secrets.slackClientSecret.secretArn,
        // --- OAuth state HMAC シークレット (BE-C-1: CSRF 対策) ---
        OAUTH_STATE_SECRET: ssm.StringParameter.valueForStringParameter(
          this,
          "/saborou/oauth/state-secret",
        ),
        // --- Slack OAuth 開始用の client_id（GET /auth/slack で使用） ---
        // 機密ではない公開IDだが、ハードコードを避け SSM 経由で注入する。
        SLACK_CLIENT_ID: ssm.StringParameter.valueForStringParameter(
          this,
          "/saborou/slack/client-id",
        ),
        // Slack 遡及取得 API (POST /api/slack/sync-messages) が EventBridge へ
        // SlackBackfill イベントを publish するため必要。
        // WebhookStack → ApiStack の依存方向のため循環回避で固定名を使う
        // （WebhookStack の eventBusName と一致させること）。
        EVENT_BUS_NAME: `saborou-event-bus-${environment}`,
        // per-user の Slack Bot Token シークレット名プレフィックス
        // （遡及取得 API が認証ユーザーの Bot Token を取得するため）
        SLACK_BOT_TOKEN_SECRET_PREFIX: `saborou/slack-bot-token/`,
        // Bedrock: SaboriProposerAgent が API Lambda 内で直接 Bedrock を呼び出す
        BEDROCK_REGION: "ap-northeast-1",
      },
    });

    // --- Bedrock 権限付与 (SaboriProposerAgent が API Lambda から直接呼び出す) ---
    honoFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: [
          // Claude Sonnet 4.6: JP Geo クロスリージョン推論プロファイル (inference-profile ARN にはアカウント ID が必要)
          `arn:aws:bedrock:ap-northeast-1:${this.account}:inference-profile/jp.anthropic.claude-sonnet-4-6`,
          `arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-sonnet-4-6`,
          `arn:aws:bedrock:ap-northeast-3::foundation-model/anthropic.claude-sonnet-4-6`,
          // Claude Haiku 4.5 (PersonaRenderer): JP Geo クロスリージョン推論プロファイル
          // ※ Haiku 3.5 は ap-northeast-1 に存在しないため 4.5 を使用
          `arn:aws:bedrock:ap-northeast-1:${this.account}:inference-profile/jp.anthropic.claude-haiku-4-5-20251001-v1:0`,
          `arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0`,
          `arn:aws:bedrock:ap-northeast-3::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0`,
        ],
      }),
    );

    // --- AWS Marketplace 権限付与 (Bedrock モデルアクセス確認に必要) ---
    honoFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "aws-marketplace:ViewSubscriptions",
          "aws-marketplace:Subscribe",
          "aws-marketplace:Unsubscribe",
        ],
        resources: ["*"],
      }),
    );

    // --- DynamoDB 権限付与 ---
    props.data.tables.users.grantReadWriteData(honoFn);
    props.data.tables.connections.grantReadWriteData(honoFn);
    // 変更: grantReadData → grantReadWriteData (ITaskCandidateRepository.delete が書き込み権限を必要とするため)
    props.data.tables.taskCandidates.grantReadWriteData(honoFn);
    props.data.tables.tasks.grantReadWriteData(honoFn);
    props.data.tables.proposals.grantReadWriteData(honoFn);
    props.data.tables.honneData.grantReadWriteData(honoFn);
    props.data.tables.personas.grantReadData(honoFn);

    // --- Secrets Manager 権限付与 (追加: U-04 Slack OAuth) ---
    props.data.secrets.slackClientSecret.grantRead(honoFn);

    // --- per-user Slack Bot Token 読み取り権限（遡及取得 API が使用） ---
    honoFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:saborou/slack-bot-token/*`,
        ],
      }),
    );

    // --- EventBridge PutEvents 権限（遡及取得 API が SlackBackfill を publish） ---
    honoFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["events:PutEvents"],
        resources: [
          `arn:aws:events:${this.region}:${this.account}:event-bus/saborou-event-bus-${environment}`,
        ],
      }),
    );

    // --- JWT オーソライザー ---
    const authorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
      "CognitoAuthorizer",
      `https://cognito-idp.ap-northeast-1.amazonaws.com/${props.cognito.userPool.userPoolId}`,
      {
        jwtAudience: [props.cognito.userPoolClient.userPoolClientId],
        authorizerName: "CognitoJwtAuthorizer",
        identitySource: ["$request.header.Authorization"],
      },
    );

    // --- HTTP API ---
    const httpApi = new apigatewayv2.HttpApi(this, "HttpApi", {
      apiName: `saborou-api-${environment}`,
      corsPreflight: {
        allowOrigins: [
          "http://localhost:5173",
          ...(props.frontendDomainName
            ? [`https://${props.frontendDomainName}`]
            : []),
        ],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowHeaders: ["Authorization", "Content-Type", "X-Requested-With"],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // ヘルスチェックルート (認証なし)
    httpApi.addRoutes({
      path: "/health",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        "HealthIntegration",
        honoFn,
      ),
    });

    // Slack OAuth コールバック (認証なし)
    // Slack からのブラウザリダイレクトで来るため JWT は付かない。
    // CSRF は state パラメータの HMAC 署名検証（auth.ts verifyState）で担保する。
    httpApi.addRoutes({
      path: "/api/auth/slack/callback",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        "SlackCallbackIntegration",
        honoFn,
      ),
    });

    // メインルート (JWT 認証必須)
    // OPTIONS は除外: API Gateway の corsPreflight が preflight を自動処理する。
    // ANY に OPTIONS を含めると JWT Authorizer が preflight に 401 を返し CORS が壊れる。
    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [
        apigatewayv2.HttpMethod.GET,
        apigatewayv2.HttpMethod.POST,
        apigatewayv2.HttpMethod.PUT,
        apigatewayv2.HttpMethod.DELETE,
        apigatewayv2.HttpMethod.PATCH,
        apigatewayv2.HttpMethod.HEAD,
      ],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        "HonoIntegration",
        honoFn,
      ),
      authorizer,
    });

    // --- CfnOutputs ---
    new cdk.CfnOutput(this, "HttpApiUrl", {
      value: httpApi.apiEndpoint,
      description: "HTTP API Gateway endpoint URL",
      exportName: `SaborouHttpApiUrl-${environment}`,
    });

    new cdk.CfnOutput(this, "HonoFnArn", {
      value: honoFn.functionArn,
      description: "Hono Lambda function ARN",
    });

    // --- cdk-nag 抑制 ---
    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-IAM4",
        reason:
          "AWSLambdaBasicExecutionRole is managed policy used by Lambda; minimum required",
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "X-Ray tracing and CloudWatch Logs require wildcard resource in policy",
      },
      {
        id: "AwsSolutions-L1",
        reason:
          "nodejs22.x is the latest stable Node.js runtime; cdk-nag may not have updated its reference list yet",
      },
      {
        id: "AwsSolutions-APIG1",
        reason:
          "HTTP API access logging is disabled for hackathon scope to reduce cost; CloudWatch Logs on Lambda covers observability",
      },
      {
        id: "AwsSolutions-APIG4",
        reason:
          "Health check route /health intentionally has no auth to allow load balancer/uptime monitoring",
      },
    ]);

    this.exports = {
      httpApiUrl: httpApi.apiEndpoint,
      honoFn,
    };
  }
}
