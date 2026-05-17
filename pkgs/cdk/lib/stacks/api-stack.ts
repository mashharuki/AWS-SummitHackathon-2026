import * as cdk from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2Authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as apigatewayv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { NagSuppressions } from "cdk-nag";
import type { Construct } from "constructs";
import type { CognitoStackExports } from "./cognito-stack";
import type { DataStackExports } from "./data-stack";

export interface ApiStackProps extends cdk.StackProps {
  readonly cognito: CognitoStackExports;
  readonly data: DataStackExports;
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
        // 注: EVENT_BUS_NAME は API Lambda では不要 (webhook Lambda のみが使用)
      },
    });

    // --- DynamoDB 権限付与 ---
    props.data.tables.users.grantReadWriteData(honoFn);
    props.data.tables.connections.grantReadWriteData(honoFn);
    // 変更: grantReadData → grantReadWriteData (ITaskCandidateRepository.delete が書き込み権限を必要とするため)
    props.data.tables.taskCandidates.grantReadWriteData(honoFn);
    props.data.tables.tasks.grantReadWriteData(honoFn);
    props.data.tables.proposals.grantReadData(honoFn);
    props.data.tables.honneData.grantReadWriteData(honoFn);
    props.data.tables.personas.grantReadData(honoFn);

    // --- Secrets Manager 権限付与 (追加: U-04 Slack OAuth) ---
    props.data.secrets.slackClientSecret.grantRead(honoFn);

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
        allowOrigins: ["http://localhost:5173", "https://*"],
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

    // メインルート (JWT 認証必須)
    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigatewayv2.HttpMethod.ANY],
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
