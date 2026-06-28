import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { SaborouDataStack } from "../lib/stacks/data-stack";

function buildTemplate(): Template {
  const app = new cdk.App({ context: { environment: "test" } });
  const stack = new SaborouDataStack(app, "TestDataStack");
  return Template.fromStack(stack);
}

describe("SaborouDataStack", () => {
  let template: Template;

  beforeAll(() => {
    template = buildTemplate();
  });

  test("8 DynamoDB tables are created (7 existing + GoogleCalendarCache)", () => {
    template.resourceCountIs("AWS::DynamoDB::Table", 8);
  });

  test("All tables use PAY_PER_REQUEST billing mode", () => {
    const tables = template.findResources("AWS::DynamoDB::Table");
    const tableList = Object.values(tables);
    // biome-ignore lint/complexity/noForEach lint/suspicious/noExplicitAny: forEach is idiomatic in CDK test helpers; any is required for CDK template shape
    tableList.forEach((table: any) => {
      expect(table.Properties.BillingMode).toBe("PAY_PER_REQUEST");
    });
  });

  test("All tables have encryption enabled", () => {
    const tables = template.findResources("AWS::DynamoDB::Table");
    const tableList = Object.values(tables);
    // biome-ignore lint/complexity/noForEach lint/suspicious/noExplicitAny: forEach is idiomatic in CDK test helpers; any is required for CDK template shape
    tableList.forEach((table: any) => {
      expect(table.Properties.SSESpecification?.SSEEnabled).toBe(true);
    });
  });

  test("TaskCandidates table has TTL attribute", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: Match.stringLikeRegexp("saborou-task-candidates"),
      TimeToLiveSpecification: {
        AttributeName: "ttl",
        Enabled: true,
      },
    });
  });

  test("TaskCandidates table has GSI-UserCreatedAt index", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: Match.stringLikeRegexp("saborou-task-candidates"),
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: "GSI-UserCreatedAt",
          Projection: { ProjectionType: "ALL" },
        }),
      ]),
    });
  });

  test("Tasks table has GSI-UserStatus index", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: Match.stringLikeRegexp("saborou-tasks"),
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({ IndexName: "GSI-UserStatus" }),
      ]),
    });
  });

  test("4 Secrets Manager secrets are created (Slack client, Slack signing, Google client, Travelpayouts)", () => {
    template.resourceCountIs("AWS::SecretsManager::Secret", 4);
  });

  test("Google OAuth client secret is created with correct naming", () => {
    template.hasResourceProperties("AWS::SecretsManager::Secret", {
      Name: Match.stringLikeRegexp("/saborou/google/client-secret"),
      Description: "Google OAuth Client ID and Secret (JSON format)",
    });
  });

  test("Travelpayouts credentials secret is created with correct naming", () => {
    template.hasResourceProperties("AWS::SecretsManager::Secret", {
      Name: Match.stringLikeRegexp("/saborou/travelpayouts/credentials-test"),
      Description: "Travelpayouts credentials JSON: apiToken, marker, trs",
    });
  });

  test("GoogleCalendarCache table is created with TTL", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: Match.stringLikeRegexp("saborou-google-calendar-cache"),
      TimeToLiveSpecification: {
        AttributeName: "ttl",
        Enabled: true,
      },
    });
  });

  test("Travel itinerary bucket is private, encrypted, and HTTPS-only", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" },
          }),
        ]),
      }),
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      LifecycleConfiguration: Match.objectLike({
        Rules: Match.arrayWith([
          Match.objectLike({
            Status: "Enabled",
            ExpirationInDays: 90,
          }),
        ]),
      }),
    });
    const buckets = template.findResources("AWS::S3::Bucket");
    const bucketNames = JSON.stringify(
      Object.values(buckets).map((bucket) => bucket.Properties?.BucketName),
    );
    expect(bucketNames).toContain("saborou-travel-itineraries");
    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Deny",
            Action: "s3:*",
            Condition: { Bool: { "aws:SecureTransport": "false" } },
          }),
        ]),
      }),
    });
  });

  test("Travel itinerary CloudFront distribution uses OAC, logging, and security headers", () => {
    template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Enabled: true,
        Logging: Match.objectLike({
          Prefix: "cloudfront/",
        }),
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: "redirect-to-https",
          AllowedMethods: ["GET", "HEAD"],
        }),
      }),
    });
    template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: Match.objectLike({
          ContentSecurityPolicy: Match.objectLike({
            ContentSecurityPolicy: Match.stringLikeRegexp("default-src 'none'"),
          }),
          StrictTransportSecurity: Match.objectLike({
            AccessControlMaxAgeSec: 31536000,
          }),
          ContentTypeOptions: Match.anyValue(),
          FrameOptions: Match.objectLike({ FrameOption: "DENY" }),
          ReferrerPolicy: Match.objectLike({
            ReferrerPolicy: "strict-origin-when-cross-origin",
          }),
        }),
      }),
    });
  });

  test("All tables have DESTROY removal policy in non-prod (test) environment", () => {
    // context: environment = "test" (非 prod) なので DESTROY が正しい
    const tables = template.findResources("AWS::DynamoDB::Table");
    const tableList = Object.values(tables);
    // biome-ignore lint/complexity/noForEach lint/suspicious/noExplicitAny: forEach is idiomatic in CDK test helpers; any is required for CDK template shape
    tableList.forEach((table: any) => {
      expect(table.DeletionPolicy).toBe("Delete");
      expect(table.UpdateReplacePolicy).toBe("Delete");
    });
  });
});
