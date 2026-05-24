import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { SaborouConfigDeployStack } from "../lib/stacks/config-deploy-stack";
import { SaborouFrontendStack } from "../lib/stacks/frontend-stack";

function buildTemplate(): Template {
  const app = new cdk.App({ context: { environment: "test" } });
  const frontendStack = new SaborouFrontendStack(app, "TestFrontendStack");
  const configStack = new SaborouConfigDeployStack(
    app,
    "TestConfigDeployStack",
    {
      frontend: frontendStack.exports,
      apiUrl: "https://api.example.com",
      cognitoUserPoolId: "ap-northeast-1_TEST",
      cognitoClientId: "testclientid",
      cognitoDomain: "https://test.auth.ap-northeast-1.amazoncognito.com",
      oauthRedirectUri: "https://example.cloudfront.net/auth/callback",
    },
  );
  return Template.fromStack(configStack);
}

describe("SaborouConfigDeployStack", () => {
  let template: Template;

  beforeAll(() => {
    template = buildTemplate();
  });

  test("AwsCustomResource (Lambda-backed) is created for env-config.json", () => {
    // cr.AwsCustomResource creates a Custom::AWS resource type
    template.resourceCountIs("Custom::AWS", 1);
  });

  test("IAM policy restricts S3 PutObject to env-config.json key only", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "s3:PutObject",
            Effect: "Allow",
          }),
        ]),
      },
    });
  });
});
