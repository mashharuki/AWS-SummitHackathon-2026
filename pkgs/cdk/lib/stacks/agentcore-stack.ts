import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { CfnGateway, CfnGatewayTarget } from "aws-cdk-lib/aws-bedrockagentcore";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { NagSuppressions } from "cdk-nag";
import type { Construct } from "constructs";

/**
 * AgentCore Gateway スタックのプロパティ。
 * bin/cdk.ts から Cognito / Api スタックの出力を渡す。
 */
export interface AgentCoreStackProps extends cdk.StackProps {
  /** Cognito User Pool ID（Custom JWT の discoveryUrl 構築に使用） */
  readonly cognitoUserPoolId: string;
  /** Cognito User Pool Client ID（allowedClients / allowedAudience に使用） */
  readonly cognitoClientId: string;
  /**
   * Hono API の HTTP API ID（execute-api ARN を最小権限で構築するために使用）。
   * ApiStack の exports.httpApiId を渡す。
   */
  readonly httpApiId: string;
}

/**
 * 公開する OpenAPI スキーマの S3 オブジェクトキー。
 * schemas/ 配下のファイル名と一致させる。
 */
const OPENAPI_SCHEMA_KEY = "saborou-openapi.yaml";

/**
 * SABOROU AgentCore Gateway スタック（INF-V2-01）。
 *
 * Hono API を Amazon Bedrock AgentCore Gateway 経由で MCP サーバーとして公開する。
 * - OpenAPI スキーマ保管用 S3 バケット
 * - Gateway 実行 IAM ロール（execute-api:Invoke を Hono API のみに限定）
 * - CfnGateway（Cognito Custom JWT 認証 / MCP プロトコル）
 * - CfnGatewayTarget（OpenAPI スキーマ → MCP ツール自動生成）
 *
 * aws-cdk-lib 2.232.1 時点で AgentCore の L2 construct は存在しないため、
 * L1 (Cfn) リソースで実装している。
 */
export class SaborouAgentCoreStack extends cdk.Stack {
  /** MCP エンドポイント URL（ElevenLabs SDK の接続先） */
  public readonly gatewayUrl: string;
  /** Gateway の ARN */
  public readonly gatewayArn: string;
  /** Gateway の識別子（Target の gatewayIdentifier に使用） */
  public readonly gatewayIdentifier: string;

  constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext("environment") ?? "dev";
    const isProd = environment === "prod";

    // --- 1. OpenAPI スキーマ保管用 S3 バケット ---
    // SSE-S3 / パブリックアクセス全面ブロック / HTTPS 必須。
    // dev は破棄しやすいよう DESTROY + autoDeleteObjects、prod は RETAIN。
    const schemaBucket = new s3.Bucket(this, "SchemaBucket", {
      bucketName: `saborou-agentcore-schema-${environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // schemas/ 配下の OpenAPI YAML を S3 にデプロイする。
    new s3deploy.BucketDeployment(this, "DeploySchema", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../schemas"))],
      destinationBucket: schemaBucket,
      prune: true,
      memoryLimit: 256,
    });

    // --- 2. Gateway 実行 IAM ロール ---
    // AgentCore Gateway サービスが assume し、Hono API の特定 ARN のみを
    // execute-api:Invoke で呼び出せる最小権限ロール。
    const gatewayRole = new iam.Role(this, "GatewayRole", {
      roleName: `saborou-agentcore-gateway-${environment}`,
      assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
      description:
        "AgentCore Gateway execution role; invokes the Hono HTTP API via execute-api and reads the OpenAPI schema from S3",
    });

    // Hono API（HTTP API）のすべてのルート/ステージへの Invoke を許可する。
    // リソースを当該 API ID に限定することで最小権限を担保する。
    const honoApiExecuteArn = cdk.Stack.of(this).formatArn({
      service: "execute-api",
      resource: props.httpApiId,
      resourceName: "*/*/*",
    });
    gatewayRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "InvokeHonoHttpApi",
        effect: iam.Effect.ALLOW,
        actions: ["execute-api:Invoke"],
        resources: [honoApiExecuteArn],
      }),
    );

    // Gateway が OpenAPI スキーマを S3 から取得できるようにする。
    schemaBucket.grantRead(gatewayRole);

    // --- 3. CfnGateway（Cognito Custom JWT 認証 / MCP プロトコル） ---
    // discoveryUrl は Cognito User Pool の OpenID Connect Discovery エンドポイント。
    const discoveryUrl = `https://cognito-idp.${this.region}.amazonaws.com/${props.cognitoUserPoolId}/.well-known/openid-configuration`;

    const gateway = new CfnGateway(this, "Gateway", {
      name: `saborou-mcp-gateway-${environment}`,
      roleArn: gatewayRole.roleArn,
      protocolType: "MCP",
      authorizerType: "CUSTOM_JWT",
      authorizerConfiguration: {
        customJwtAuthorizer: {
          discoveryUrl,
          allowedClients: [props.cognitoClientId],
          allowedAudience: [props.cognitoClientId],
        },
      },
      protocolConfiguration: {
        mcp: {
          instructions:
            "SABOROU tools for voice-driven Slack workflow automation. Use listTasks to gather context about the user's current work, streamProposal to judge an incoming Slack message and draft a reply or polite decline, sendSlackReply to post a user-approved reply to Slack, and scheduleProgressReport to schedule a recurring daily task progress report. Always obtain explicit user approval before calling sendSlackReply.",
          searchType: "SEMANTIC",
          supportedVersions: ["2025-03-26"],
        },
      },
      description:
        "SABOROU MCP gateway exposing the Hono API as MCP tools for the ElevenLabs voice agent",
      // prod は INFO（機密漏洩防止）、非 prod は DEBUG で開発時の原因調査を容易にする。
      exceptionLevel: isProd ? "INFO" : "DEBUG",
    });
    gateway.node.addDependency(gatewayRole);

    // --- 4. CfnGatewayTarget（OpenAPI スキーマ → MCP ツール） ---
    // OpenAPI スキーマを S3 から読み込み MCP ツールを自動生成する。
    // 認証は GATEWAY_IAM_ROLE（Gateway ロールの execute-api:Invoke を使用）。
    const target = new CfnGatewayTarget(this, "HonoApiTarget", {
      name: "saborou-hono-api",
      gatewayIdentifier: gateway.attrGatewayIdentifier,
      description:
        "Maps the SABOROU Hono HTTP API OpenAPI schema to MCP tools (listTasks / streamProposal / sendSlackReply / scheduleProgressReport)",
      targetConfiguration: {
        mcp: {
          openApiSchema: {
            s3: {
              uri: schemaBucket.s3UrlForObject(OPENAPI_SCHEMA_KEY),
              bucketOwnerAccountId: this.account,
            },
          },
        },
      },
      credentialProviderConfigurations: [
        {
          credentialProviderType: "GATEWAY_IAM_ROLE",
        },
      ],
    });
    target.node.addDependency(gateway);

    this.gatewayUrl = gateway.attrGatewayUrl;
    this.gatewayArn = gateway.attrGatewayArn;
    this.gatewayIdentifier = gateway.attrGatewayIdentifier;

    // --- CfnOutputs ---
    new cdk.CfnOutput(this, "GatewayArn", {
      value: gateway.attrGatewayArn,
      description: "AgentCore Gateway ARN",
      exportName: `SaborouAgentCoreGatewayArn-${environment}`,
    });
    new cdk.CfnOutput(this, "GatewayUrl", {
      value: gateway.attrGatewayUrl,
      description: "AgentCore Gateway MCP endpoint URL (ElevenLabs 接続先)",
      exportName: `SaborouAgentCoreGatewayUrl-${environment}`,
    });
    new cdk.CfnOutput(this, "GatewayIdentifier", {
      value: gateway.attrGatewayIdentifier,
      description: "AgentCore Gateway identifier",
      exportName: `SaborouAgentCoreGatewayId-${environment}`,
    });
    new cdk.CfnOutput(this, "SchemaBucketName", {
      value: schemaBucket.bucketName,
      description: "OpenAPI schema S3 bucket name",
    });

    // --- cdk-nag 抑制 ---
    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-IAM4",
        reason:
          "BucketDeployment custom resource uses CDK-managed AWSLambdaBasicExecutionRole; minimum required",
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Gateway role scopes execute-api:Invoke to the specific Hono HTTP API id; the */*/* path wildcard is required to allow all routes/methods/stages of that single API. BucketDeployment also requires S3 wildcards on the schema bucket to operate.",
      },
      {
        id: "AwsSolutions-L1",
        reason:
          "BucketDeployment Lambda runtime is managed by the CDK framework",
      },
      {
        id: "AwsSolutions-S1",
        reason:
          "Server access logging is omitted for the schema bucket to reduce hackathon cost; the bucket only holds a non-sensitive OpenAPI schema and is fully private",
      },
    ]);
  }
}
