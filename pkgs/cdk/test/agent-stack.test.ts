import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { SaborouDataStack } from "../lib/stacks/data-stack";
import { SaborouAgentStack } from "../lib/stacks/agent-stack";

function buildTemplate(): Template {
  const app = new cdk.App({ context: { environment: "test" } });
  const dataStack = new SaborouDataStack(app, "TestData");
  const agentStack = new SaborouAgentStack(app, "TestAgentStack", {
    data: dataStack.exports,
  });
  return Template.fromStack(agentStack);
}

describe("SaborouAgentStack", () => {
  let template: Template;

  beforeAll(() => {
    template = buildTemplate();
  });

  test("Two Lambda functions are created (TaskExtractor + SaboriProposer)", () => {
    template.resourceCountIs("AWS::Lambda::Function", 2);
  });

  test("Both Lambda functions use ARM_64 architecture", () => {
    const fns = template.findResources("AWS::Lambda::Function");
    const fnList = Object.values(fns);
    fnList.forEach((fn: any) => {
      expect(fn.Properties.Architectures).toContain("arm64");
    });
  });

  test("TaskExtractor Lambda has 512MB memory and 60s timeout", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "task-extractor/TaskExtractorLambdaHandler.handler",
      MemorySize: 512,
      Timeout: 60,
    });
  });

  test("SaboriProposer Lambda has 1024MB memory and 90s timeout (U-03b spec)", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "sabori-proposer/SaboriProposerLambdaHandler.handler",
      MemorySize: 1024,
      Timeout: 90,
    });
  });

  test("Two DLQs are created for Lambda functions", () => {
    template.resourceCountIs("AWS::SQS::Queue", 2);
  });

  test("DLQ queues have 1-day retention", () => {
    const queues = template.findResources("AWS::SQS::Queue");
    const queueList = Object.values(queues);
    queueList.forEach((q: any) => {
      // MessageRetentionPeriod = 86400 seconds = 1 day
      expect(q.Properties.MessageRetentionPeriod).toBe(86400);
    });
  });

  test("IAM policy includes Bedrock InvokeModel permissions", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              "bedrock:InvokeModel",
              "bedrock:InvokeModelWithResponseStream",
            ]),
            Effect: "Allow",
          }),
        ]),
      },
    });
  });
});
