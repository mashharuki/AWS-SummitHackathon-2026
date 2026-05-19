import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Match, Template } from "aws-cdk-lib/assertions";
import { SaborouCognitoStack } from "../lib/stacks/cognito-stack";
import { SaborouDataStack } from "../lib/stacks/data-stack";
import { SaborouApiStack } from "../lib/stacks/api-stack";

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

  test("Log group has 14-day retention", () => {
    template.hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: Match.stringLikeRegexp("saborou-api"),
      RetentionInDays: 14,
    });
  });
});
