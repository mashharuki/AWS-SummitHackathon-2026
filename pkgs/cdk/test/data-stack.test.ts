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

  test("7 DynamoDB tables are created", () => {
    template.resourceCountIs("AWS::DynamoDB::Table", 7);
  });

  test("All tables use PAY_PER_REQUEST billing mode", () => {
    const tables = template.findResources("AWS::DynamoDB::Table");
    const tableList = Object.values(tables);
    tableList.forEach((table: any) => {
      expect(table.Properties.BillingMode).toBe("PAY_PER_REQUEST");
    });
  });

  test("All tables have encryption enabled", () => {
    const tables = template.findResources("AWS::DynamoDB::Table");
    const tableList = Object.values(tables);
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

  test("3 Secrets Manager secrets are created", () => {
    template.resourceCountIs("AWS::SecretsManager::Secret", 3);
  });

  test("All tables have RETAIN removal policy", () => {
    const tables = template.findResources("AWS::DynamoDB::Table");
    const tableList = Object.values(tables);
    tableList.forEach((table: any) => {
      expect(table.DeletionPolicy).toBe("Retain");
      expect(table.UpdateReplacePolicy).toBe("Retain");
    });
  });
});
