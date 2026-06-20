import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2Authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as apigatewayv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { NagSuppressions } from "cdk-nag";
import type { Construct } from "constructs";
import type { CUSTOM_DOMAIN } from "./acm-us-east-1-stack";
import type { CognitoStackExports } from "./cognito-stack";
import type { DataStackExports } from "./data-stack";

export interface ApiStackProps extends cdk.StackProps {
  readonly cognito: CognitoStackExports;
  readonly data: DataStackExports;
  readonly frontendDomainName?: string;
  /**
   * カスタムドメイン有効時の ap-northeast-1 証明書（API Gateway 用）。
   * customDomain context フラグが true のときのみ指定する。
   * @default undefined
   */
  readonly apiCertificate?: acm.ICertificate;
  /**
   * API Gateway に設定するカスタムドメイン名。
   * @default undefined
   */
  readonly customApiDomainName?: (typeof CUSTOM_DOMAIN)["api"];
}

export interface ApiStackExports {
  readonly httpApiUrl: string;
  /**
   * HTTP API の API ID。AgentCore Gateway の execute-api ARN を
   * 最小権限で構築するために使用する。
   */
  readonly httpApiId: string;
  readonly honoFn: lambda.Function;
  /**
   * カスタムドメイン有効時の API URL（https://saborou-api.agentic-jp.com）。
   * 無効時は API Gateway デフォルトエンドポイント URL になる。
   */
  readonly apiUrl: string;
}

/**
 * Saborou API Stack — HTTP API Gateway と Lambda バックエンド
 */
export class SaborouApiStack extends cdk.Stack {
  public readonly exports: ApiStackExports;

  /**
   * コンストラクター
   * @param scope
   * @param id
   * @param props
   */
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext("environment") ?? "dev";

    // --- Lambda: Hono バックエンド ---
    const honoFnLogGroup = new logs.LogGroup(this, "HonoFnLogGroup", {
      logGroupName: `/aws/lambda/saborou-api-${environment}`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const httpApiAccessLogGroup = new logs.LogGroup(
      this,
      "HttpApiAccessLogGroup",
      {
        logGroupName: `/aws/apigateway/saborou-api-${environment}`,
        retention: logs.RetentionDays.THREE_MONTHS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      },
    );

    const accessLogFormat = apigateway.AccessLogFormat.custom(
      JSON.stringify({
        requestId: "$context.requestId",
        routeKey: "$context.routeKey",
        status: "$context.status",
        responseLatency: "$context.responseLatency",
        integrationStatus: "$context.integrationStatus",
        sourceIp: "$context.identity.sourceIp",
        userAgent: "$context.identity.userAgent",
      }),
    );

    const mcpUnauthorizedMetric = new logs.MetricFilter(
      this,
      "McpUnauthorizedMetricFilter",
      {
        logGroup: honoFnLogGroup,
        metricNamespace: "Saborou/Mcp",
        metricName: "Unauthorized",
        filterPattern: logs.FilterPattern.literal(
          '{ $.action = "mcp_tool_call" && $.status = "unauthorized" }',
        ),
        metricValue: "1",
      },
    );

    const mcpForbiddenMetric = new logs.MetricFilter(
      this,
      "McpForbiddenMetricFilter",
      {
        logGroup: honoFnLogGroup,
        metricNamespace: "Saborou/Mcp",
        metricName: "Forbidden",
        filterPattern: logs.FilterPattern.literal(
          '{ $.action = "mcp_tool_call" && $.status = "forbidden" }',
        ),
        metricValue: "1",
      },
    );

    const mcpToolErrorMetric = new logs.MetricFilter(
      this,
      "McpToolErrorMetricFilter",
      {
        logGroup: honoFnLogGroup,
        metricNamespace: "Saborou/Mcp",
        metricName: "ToolError",
        filterPattern: logs.FilterPattern.literal(
          '{ $.action = "mcp_tool_call" && $.status = "tool_error" }',
        ),
        metricValue: "1",
      },
    );

    for (const [id, metricFilter, threshold] of [
      ["McpUnauthorizedAlarm", mcpUnauthorizedMetric, 5],
      ["McpForbiddenAlarm", mcpForbiddenMetric, 5],
      ["McpToolErrorAlarm", mcpToolErrorMetric, 3],
    ] as const) {
      new cloudwatch.Alarm(this, id, {
        metric: metricFilter.metric({
          statistic: "Sum",
          period: cdk.Duration.minutes(5),
        }),
        threshold,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }

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
        SLACK_BOT_TOKEN_SECRET_PREFIX: "saborou/slack-bot-token/",
        // per-user の Slack User Token シークレット名プレフィックス
        // （ユーザー自身のアカウントから返信するために使用）
        SLACK_USER_TOKEN_SECRET_PREFIX: "saborou/slack-user-token/",
        // Slack OAuth コールバック成功後のフロント（CloudFront）リダイレクト先。
        // 未設定だと localhost:5173 にフォールバックしてしまう。
        ...(props.frontendDomainName
          ? { FRONTEND_URL: `https://${props.frontendDomainName}` }
          : {}),
        // Bedrock: SaboriProposerAgent が API Lambda 内で直接 Bedrock を呼び出す
        BEDROCK_REGION: "ap-northeast-1",
        // --- Google OAuth（差分5）---
        GOOGLE_CLIENT_SECRET_ARN:
          props.data.secrets.googleClientSecret.secretArn,
        GOOGLE_CLIENT_ID: ssm.StringParameter.valueForStringParameter(
          this,
          "/saborou/google/client-id",
        ),
        // --- Google Calendar Cache（U-07b）---
        DYNAMODB_TABLE_GOOGLE_CALENDAR_CACHE:
          props.data.tables.googleCalendarCache.tableName,
        // --- Travelpayouts credentials for travel plan MCP/API ---
        TRAVELPAYOUTS_CREDENTIALS_SECRET_ARN:
          props.data.secrets.travelpayoutsCredentialsSecret.secretArn,
      },
    });

    // --- Bedrock 権限付与 (SaboriProposerAgent が API Lambda から直接呼び出す) ---
    honoFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [
          // Claude Sonnet 4.6: JP Geo クロスリージョン推論プロファイル (inference-profile ARN にはアカウント ID が必要)
          `arn:aws:bedrock:ap-northeast-1:${this.account}:inference-profile/jp.anthropic.claude-sonnet-4-6`,
          "arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-sonnet-4-6",
          "arn:aws:bedrock:ap-northeast-3::foundation-model/anthropic.claude-sonnet-4-6",
          // Claude Haiku 4.5 (PersonaRenderer): JP Geo クロスリージョン推論プロファイル
          // ※ Haiku 3.5 は ap-northeast-1 に存在しないため 4.5 を使用
          `arn:aws:bedrock:ap-northeast-1:${this.account}:inference-profile/jp.anthropic.claude-haiku-4-5-20251001-v1:0`,
          "arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
          "arn:aws:bedrock:ap-northeast-3::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
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
    // Google Calendar キャッシュ: 読み書き（Calendar 取り込み時書き込み・提案時読み込み）
    props.data.tables.googleCalendarCache.grantReadWriteData(honoFn);

    // --- Secrets Manager 権限付与 (追加: U-04 Slack OAuth) ---
    props.data.secrets.slackClientSecret.grantRead(honoFn);

    // --- Google OAuth client secret の読み取り権限（差分5）---
    props.data.secrets.googleClientSecret.grantRead(honoFn);

    // --- Travelpayouts credentials secret: read-only, single secret scope ---
    props.data.secrets.travelpayoutsCredentialsSecret.grantRead(honoFn);

    // --- per-user Slack Bot Token の読み書き権限 ---
    // 読み取り（遡及取得 API）と書き込み（OAuth コールバックでの保存）の両方が必要。
    honoFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecret",
          "secretsmanager:DescribeSecret",
        ],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:saborou/slack-bot-token/*`,
        ],
      }),
    );
    // --- per-user Slack User Token の読み書き権限 ---
    honoFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecret",
          "secretsmanager:DescribeSecret",
        ],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:saborou/slack-user-token/*`,
        ],
      }),
    );
    // CreateSecret はリソース未作成のため * 指定（OAuth 初回連携で Bot/User Token を新規作成）
    honoFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:CreateSecret"],
        resources: ["*"],
      }),
    );

    // --- per-user Google token の読み書き権限（差分5）---
    // `saborou/google-token/<userId>` に refreshToken/accessToken を JSON 保存
    honoFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecret",
          "secretsmanager:DescribeSecret",
          "secretsmanager:DeleteSecret", // 連携解除時の ForceDelete（dev）
        ],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:saborou/google-token/*`,
        ],
      }),
    );

    // --- MCP API キー読み取り権限（ElevenLabs 長期認証用） ---
    honoFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:saborou/mcp-api-key*`,
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
      createDefaultStage: false,
      // CORS preflight は API Gateway が処理する（OPTIONS は JWT Authorizer を通さない）。
      // 注意: API Gateway v2 は chrome-extension:// 形式の個別オリジンを
      // allowOrigins に受け付けない（"Invalid format for origin"）。
      // Chrome 拡張（Side Panel）からのアクセスを許可するため allowOrigins は
      // ワイルドカード "*" を使う。credentials を使わない（JWT は Authorization
      // ヘッダで送るが Cookie は使わない）ため "*" + Authorization の併用が可能。
      corsPreflight: {
        allowOrigins: ["*"],
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

    // Google OAuth コールバック (認証なし)
    // Google からのブラウザリダイレクトで来るため JWT は付かない。
    // CSRF は state パラメータの HMAC 署名検証（google-auth.ts verifyState）で担保する。
    httpApi.addRoutes({
      path: "/api/auth/google/callback",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        "GoogleCallbackIntegration",
        honoFn,
      ),
    });

    // MCP adapter route (REST): POST /api/mcp/tools/{toolName}
    // API Gateway authorizerなし / Lambda側でCognito JWTを検証
    httpApi.addRoutes({
      path: "/api/mcp/tools/{toolName}",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        "McpToolsIntegration",
        honoFn,
      ),
    });

    // MCP JSON-RPC 2.0 route: POST /api/mcp  (ElevenLabs streamable_http 向け)
    // API Gateway authorizerなし / Lambda内で initialize は認証不要、tools/call は Cognito JWT検証
    httpApi.addRoutes({
      path: "/api/mcp",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        "McpJsonRpcIntegration",
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

    const defaultStage = new apigatewayv2.HttpStage(this, "DefaultStage", {
      httpApi,
      stageName: "$default",
      autoDeploy: true,
      accessLogSettings: {
        destination: new apigatewayv2.LogGroupLogDestination(
          httpApiAccessLogGroup,
        ),
        format: accessLogFormat,
      },
    });
    // Match the logical ID that was recorded by the previous deployment.
    // The stage was originally created implicitly (createDefaultStage: true) under
    // HttpApiDefaultStage3EEB07D6. Overriding here turns CREATE into UPDATE so
    // CloudFormation applies the access-log settings to the existing physical resource.
    (defaultStage.node.defaultChild as cdk.CfnResource).overrideLogicalId(
      "HttpApiDefaultStage3EEB07D6",
    );

    // --- API Gateway カスタムドメイン（customDomain=true のときのみ） ---
    // ap-northeast-1 の証明書と DomainName L2 コンストラクトを使用する。
    // ApiMapping で HTTP API のデフォルトステージをカスタムドメインのルートに紐付ける。
    let apiUrl = httpApi.apiEndpoint;

    if (props.apiCertificate && props.customApiDomainName) {
      const apiDomainName = new apigatewayv2.DomainName(
        this,
        "ApiCustomDomain",
        {
          domainName: props.customApiDomainName,
          certificate: props.apiCertificate,
          // HTTP API はリージョナルエンドポイントのみ対応（EDGE は WebSocket のみ）
          endpointType: apigatewayv2.EndpointType.REGIONAL,
          securityPolicy: apigatewayv2.SecurityPolicy.TLS_1_2,
        },
      );

      // HTTP API のデフォルトステージをカスタムドメインのルートパスにマッピング
      new apigatewayv2.ApiMapping(this, "ApiDomainMapping", {
        api: httpApi,
        domainName: apiDomainName,
        stage: defaultStage,
        // mappingKey を省略することでルートパス（/）にマッピングされる
      });

      // カスタムドメイン有効時の API URL
      apiUrl = `https://${props.customApiDomainName}`;

      // Cloudflare に登録すべき DNS レコードを出力
      new cdk.CfnOutput(this, "ApiDomainRegionalDomainName", {
        value: apiDomainName.regionalDomainName,
        description:
          "[手動] Cloudflare に追加すべき API 向け CNAME レコードのターゲット値",
      });

      new cdk.CfnOutput(this, "ApiCnameDnsRecord", {
        value: `CNAME: ${props.customApiDomainName} → ${apiDomainName.regionalDomainName}  (Cloudflare Proxy OFF / DNS only)`,
        description:
          "[手動] Cloudflare に追加すべき API 向け CNAME レコード（フルテキスト）",
      });

      new cdk.CfnOutput(this, "ApiAcmDnsValidationNote", {
        value: `ACM コンソール (ap-northeast-1) で証明書 ${props.customApiDomainName} の検証 CNAME (Name / Value) を確認し、Cloudflare DNS に登録してください。Proxy は OFF（DNS only）にすること。`,
        description: "API 用 ACM DNS 検証 CNAME の登録方法",
      });
    }

    // --- CfnOutputs ---
    new cdk.CfnOutput(this, "HttpApiUrl", {
      value: httpApi.apiEndpoint,
      description: "HTTP API Gateway endpoint URL (デフォルトエンドポイント)",
      exportName: `SaborouHttpApiUrl-${environment}`,
    });

    // U-V3-04: ElevenLabs Dashboard で SABOROU をリモート MCP サーバーとして登録するための
    // streamable_http エンドポイントベース URL。カスタムドメイン有効時はカスタム URL を使用。
    new cdk.CfnOutput(this, "McpToolsBaseUrl", {
      value: `${apiUrl}/api/mcp/tools`,
      description:
        "SABOROU MCP REST adapter base URL (Chrome 拡張・AgentCore 向け)",
      exportName: `SaborouMcpToolsBaseUrl-${environment}`,
    });

    // MCP JSON-RPC 2.0 endpoint (ElevenLabs streamable_http 向け)
    new cdk.CfnOutput(this, "McpJsonRpcUrl", {
      value: `${apiUrl}/api/mcp`,
      description:
        "SABOROU MCP JSON-RPC 2.0 endpoint — ElevenLabs Dashboard streamable_http 登録先",
      exportName: `SaborouMcpJsonRpcUrl-${environment}`,
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
        id: "AwsSolutions-APIG4",
        reason:
          "Health check route /health intentionally has no auth to allow load balancer/uptime monitoring",
      },
    ]);

    this.exports = {
      httpApiUrl: httpApi.apiEndpoint,
      httpApiId: httpApi.apiId,
      honoFn,
      apiUrl,
    };
  }
}
