import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { SaborouAgentCoreStack } from "../lib/stacks/agentcore-stack";

function buildTemplate(environment = "test"): {
  template: Template;
  stack: SaborouAgentCoreStack;
} {
  const app = new cdk.App({ context: { environment } });
  const stack = new SaborouAgentCoreStack(app, "TestAgentCore", {
    env: { account: "123456789012", region: "ap-northeast-1" },
    cognitoUserPoolId: "ap-northeast-1_TESTPOOL",
    cognitoClientId: "test-client-id-1234567890",
    httpApiId: "abc123httpapi",
  });
  return { template: Template.fromStack(stack), stack };
}

describe("SaborouAgentCoreStack", () => {
  let template: Template;

  beforeAll(() => {
    template = buildTemplate().template;
  });

  test("AgentCore Gateway が 1 つ作成される", () => {
    template.resourceCountIs("AWS::BedrockAgentCore::Gateway", 1);
  });

  test("Gateway は Cognito Custom JWT 認証で構成される", () => {
    template.hasResourceProperties("AWS::BedrockAgentCore::Gateway", {
      AuthorizerType: "CUSTOM_JWT",
      Name: Match.stringLikeRegexp("saborou-mcp-gateway"),
      AuthorizerConfiguration: {
        CustomJWTAuthorizer: {
          DiscoveryUrl: Match.stringLikeRegexp(
            "cognito-idp.*\\.well-known/openid-configuration",
          ),
          AllowedClients: ["test-client-id-1234567890"],
          AllowedAudience: ["test-client-id-1234567890"],
        },
      },
    });
  });

  test("Gateway は MCP プロトコルで構成される", () => {
    template.hasResourceProperties("AWS::BedrockAgentCore::Gateway", {
      ProtocolType: "MCP",
      ProtocolConfiguration: {
        Mcp: Match.objectLike({
          Instructions: Match.stringLikeRegexp("SABOROU"),
          SearchType: "SEMANTIC",
        }),
      },
    });
  });

  test("非 prod 環境では ExceptionLevel は DEBUG", () => {
    template.hasResourceProperties("AWS::BedrockAgentCore::Gateway", {
      ExceptionLevel: "DEBUG",
    });
  });

  test("prod 環境では ExceptionLevel は INFO", () => {
    const prod = buildTemplate("prod").template;
    prod.hasResourceProperties("AWS::BedrockAgentCore::Gateway", {
      ExceptionLevel: "INFO",
    });
  });

  test("GatewayTarget が OpenAPI スキーマで作成される", () => {
    template.resourceCountIs("AWS::BedrockAgentCore::GatewayTarget", 1);
    template.hasResourceProperties("AWS::BedrockAgentCore::GatewayTarget", {
      Name: "saborou-hono-api",
      TargetConfiguration: {
        Mcp: {
          OpenApiSchema: {
            S3: Match.objectLike({
              Uri: Match.anyValue(),
            }),
          },
        },
      },
      CredentialProviderConfigurations: [
        { CredentialProviderType: "GATEWAY_IAM_ROLE" },
      ],
    });
  });

  test("OpenAPI スキーマ保管用 S3 バケットが暗号化・パブリックアクセスブロックされる", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: Match.anyValue(),
      }),
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test("Gateway 実行ロールは execute-api:Invoke を Hono API のみに限定する", () => {
    template.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Principal: { Service: "bedrock-agentcore.amazonaws.com" },
          }),
        ]),
      }),
    });
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "execute-api:Invoke",
            Effect: "Allow",
          }),
        ]),
      }),
    });

    const policies = template.findResources("AWS::IAM::Policy");
    const serializedPolicies = JSON.stringify(policies);
    expect(serializedPolicies).toContain("abc123httpapi");
    expect(serializedPolicies).toContain("$default/POST/api/mcp/tools/*");
  });

  test("Gateway 実行ロールは wildcard action や SABOROU data-plane 権限を持たない", () => {
    const policies = template.findResources("AWS::IAM::Policy");
    type PolicyDoc = {
      Properties: { PolicyDocument: { Statement: unknown[] } };
    };
    const statements = Object.values(
      policies as Record<string, PolicyDoc>,
    ).flatMap((policy) => policy.Properties.PolicyDocument.Statement ?? []);
    const allActions = statements.flatMap((stmt) => {
      const action = (stmt as { Action?: string | string[] }).Action;
      return Array.isArray(action) ? action : [action];
    });

    expect(allActions).not.toContain("*");
    expect(allActions.some((action) => action?.startsWith("dynamodb:"))).toBe(
      false,
    );
    expect(
      allActions.some((action) => action?.startsWith("secretsmanager:")),
    ).toBe(false);
  });

  test("MCP エンドポイント URL と Gateway ARN が出力される", () => {
    const outputs = template.findOutputs("*");
    const keys = Object.keys(outputs);
    expect(keys.some((k) => k.startsWith("GatewayUrl"))).toBe(true);
    expect(keys.some((k) => k.startsWith("GatewayArn"))).toBe(true);
    expect(keys.some((k) => k.startsWith("GatewayIdentifier"))).toBe(true);
  });
});
