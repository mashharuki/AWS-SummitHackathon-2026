import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { SaborouApiStack } from "../lib/stacks/api-stack";
import { SaborouCognitoStack } from "../lib/stacks/cognito-stack";
import { SaborouDataStack } from "../lib/stacks/data-stack";

function buildTemplate(): Template {
  const app = new cdk.App({ context: { environment: "test" } });
  const cognitoStack = new SaborouCognitoStack(app, "TestCognito");
  const dataStack = new SaborouDataStack(app, "TestData");
  const apiStack = new SaborouApiStack(app, "TestApiStack", {
    cognito: cognitoStack.exports,
    data: dataStack.exports,
  });
  return Template.fromStack(apiStack);
}

describe("SaborouApiStack", () => {
  let template: Template;

  beforeAll(() => {
    template = buildTemplate();
  });

  test("Lambda function is created with ARM_64 architecture", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Architectures: ["arm64"],
      Runtime: "nodejs22.x",
      MemorySize: 256,
    });
  });

  test("Lambda function has timeout of 29 seconds", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Timeout: 29,
    });
  });

  test("Lambda function has X-Ray tracing enabled", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      TracingConfig: { Mode: "Active" },
    });
  });

  test("HTTP API is created", () => {
    template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
    template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      ProtocolType: "HTTP",
    });
  });

  test("JWT Authorizer is created for Cognito", () => {
    template.resourceCountIs("AWS::ApiGatewayV2::Authorizer", 1);
    template.hasResourceProperties("AWS::ApiGatewayV2::Authorizer", {
      AuthorizerType: "JWT",
      Name: "CognitoJwtAuthorizer",
    });
  });

  test("Lambda and API access log groups have 90-day retention", () => {
    template.hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: Match.stringLikeRegexp("saborou-api"),
      RetentionInDays: 90,
    });
    template.hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: Match.stringLikeRegexp("apigateway/saborou-api"),
      RetentionInDays: 90,
    });
  });

  test("HTTP API default stage has access logging enabled", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      StageName: "$default",
      AccessLogSettings: Match.objectLike({
        DestinationArn: Match.anyValue(),
        Format: Match.stringLikeRegexp("requestId"),
      }),
    });
  });

  test("Lambda function has GOOGLE_CLIENT_SECRET_ARN environment variable", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: Match.objectLike({
          GOOGLE_CLIENT_SECRET_ARN: Match.anyValue(),
        }),
      },
    });
  });

  test("Lambda function has TRAVELPAYOUTS_CREDENTIALS_SECRET_ARN environment variable", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: Match.objectLike({
          TRAVELPAYOUTS_CREDENTIALS_SECRET_ARN: Match.anyValue(),
        }),
      },
    });
  });

  test("HonoFn can read only the Travelpayouts credentials secret resource", () => {
    const policies = template.findResources("AWS::IAM::Policy");
    type PolicyDoc = {
      Properties: { PolicyDocument: { Statement: unknown[] } };
    };
    const allStatements = Object.values(
      policies as Record<string, PolicyDoc>,
    ).flatMap((p) => p.Properties.PolicyDocument.Statement ?? []);
    const travelpayoutsStatements = allStatements.filter((stmt) => {
      const s = stmt as { Action: unknown; Resource: unknown };
      const resourceStr = JSON.stringify(s.Resource);
      return resourceStr.includes("TravelpayoutsCredentialsSecret");
    });

    expect(travelpayoutsStatements.length).toBeGreaterThan(0);
    for (const stmt of travelpayoutsStatements) {
      const s = stmt as { Action: unknown; Resource: unknown };
      const actions = Array.isArray(s.Action) ? s.Action : [s.Action];
      expect(actions).toContain("secretsmanager:GetSecretValue");
      expect(JSON.stringify(s.Resource)).not.toContain("*");
    }
  });

  test("HonoFn has IAM policy for saborou/google-token/* (secretsmanager:GetSecretValue)", () => {
    // Google token IAM ポリシーが存在することを Statement の Action から確認する
    const policies = template.findResources("AWS::IAM::Policy");
    type PolicyDoc = {
      Properties: { PolicyDocument: { Statement: unknown[] } };
    };
    const allStatements = Object.values(
      policies as Record<string, PolicyDoc>,
    ).flatMap((p) => p.Properties.PolicyDocument.Statement ?? []);
    const hasGoogleTokenPolicy = allStatements.some((stmt) => {
      const s = stmt as { Action: unknown; Resource: unknown };
      const actions: string[] = Array.isArray(s.Action)
        ? (s.Action as string[])
        : [s.Action as string];
      const resources: unknown[] = Array.isArray(s.Resource)
        ? s.Resource
        : [s.Resource];
      const hasGetSecret = actions.includes("secretsmanager:GetSecretValue");
      const resourceStr = JSON.stringify(resources);
      return hasGetSecret && resourceStr.includes("saborou/google-token");
    });
    expect(hasGoogleTokenPolicy).toBe(true);
  });

  test("Google OAuth callback route is created without authorizer", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /api/auth/google/callback",
      AuthorizationType: "NONE",
    });
  });

  test("main proxy route remains protected by JWT authorizer", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: Match.stringLikeRegexp("\\{proxy\\+\\}"),
      AuthorizationType: "JWT",
      AuthorizerId: Match.anyValue(),
    });
  });

  test("MCP adapter route is explicit and relies on Lambda-side JWT verification", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "POST /api/mcp/tools/{toolName}",
      AuthorizationType: "NONE",
    });
  });

  test("MCP audit metric filters and alarms are created", () => {
    template.resourceCountIs("AWS::Logs::MetricFilter", 3);
    template.hasResourceProperties("AWS::Logs::MetricFilter", {
      FilterPattern:
        '{ $.action = "mcp_tool_call" && $.status = "unauthorized" }',
      MetricTransformations: Match.arrayWith([
        Match.objectLike({
          MetricNamespace: "Saborou/Mcp",
          MetricName: "Unauthorized",
          MetricValue: "1",
        }),
      ]),
    });
    template.resourceCountIs("AWS::CloudWatch::Alarm", 3);
  });

  test("Lambda function has DYNAMODB_TABLE_GOOGLE_CALENDAR_CACHE environment variable (U-07b)", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: Match.objectLike({
          DYNAMODB_TABLE_GOOGLE_CALENDAR_CACHE: Match.anyValue(),
        }),
      },
    });
  });

  test("MCP CfnOutputs distinguish JSON-RPC endpoint from REST tool boundary", () => {
    const jsonRpcOutputs = template.findOutputs("McpJsonRpcUrl");
    expect(Object.keys(jsonRpcOutputs)).toHaveLength(1);
    const jsonRpcOutput = jsonRpcOutputs["McpJsonRpcUrl"];
    const jsonRpcValueStr = JSON.stringify(jsonRpcOutput.Value);
    expect(jsonRpcValueStr).toContain("/api/mcp");
    expect(jsonRpcValueStr).not.toContain("/api/mcp/tools");
    expect(jsonRpcOutput.Export?.Name).toContain("SaborouMcpJsonRpcUrl");

    // REST adapter base for AgentCore OpenAPI target. This is not the direct
    // Streamable HTTP JSON-RPC registration URL.
    const outputs = template.findOutputs("McpToolsBaseUrl");
    expect(Object.keys(outputs)).toHaveLength(1);
    const output = outputs["McpToolsBaseUrl"];
    const valueStr = JSON.stringify(output.Value);
    expect(valueStr).toContain("/api/mcp/tools");
    expect(valueStr).not.toEqual(jsonRpcValueStr);
    expect(output.Export?.Name).toContain("SaborouMcpToolsBaseUrl");
  });
});
