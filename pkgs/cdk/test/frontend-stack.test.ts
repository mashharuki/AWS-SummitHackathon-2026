import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { SaborouFrontendStack } from "../lib/stacks/frontend-stack";

function buildTemplate(): Template {
  const app = new cdk.App({ context: { environment: "test" } });
  const stack = new SaborouFrontendStack(app, "TestFrontendStack", {
    apiUrl: "https://api.example.com",
  });
  return Template.fromStack(stack);
}

describe("SaborouFrontendStack", () => {
  let template: Template;

  beforeAll(() => {
    template = buildTemplate();
  });

  test("S3 bucket blocks all public access", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test("S3 bucket enforces SSL", () => {
    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Deny",
            Condition: {
              Bool: { "aws:SecureTransport": "false" },
            },
          }),
        ]),
      },
    });
  });

  test("CloudFront distribution is created with OAC", () => {
    template.resourceCountIs("AWS::CloudFront::Distribution", 1);
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        DefaultRootObject: "index.html",
      },
    });
    // OAC is created
    template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
  });

  test("CloudFront handles SPA routing (404/403 redirect to index.html)", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: "/index.html",
          }),
          Match.objectLike({
            ErrorCode: 403,
            ResponseCode: 200,
            ResponsePagePath: "/index.html",
          }),
        ]),
      },
    });
  });

  test("CloudFront uses PRICE_CLASS_200", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        PriceClass: "PriceClass_200",
      },
    });
  });
});
