import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { SaborouCognitoStack } from "../lib/stacks/cognito-stack";
import { SaborouDataStack } from "../lib/stacks/data-stack";
import { SaborouApiStack } from "../lib/stacks/api-stack";
import { SaborouAgentStack } from "../lib/stacks/agent-stack";
import { SaborouWebhookStack } from "../lib/stacks/webhook-stack";

function buildTemplate(): Template {
  const app = new cdk.App({ context: { environment: "test" } });
  const cognitoStack = new SaborouCognitoStack(app, "TestCognito");
  const dataStack = new SaborouDataStack(app, "TestData");
  const apiStack = new SaborouApiStack(app, "TestApi", {
    cognito: cognitoStack.exports,
    data: dataStack.exports,
  });
  const agentStack = new SaborouAgentStack(app, "TestAgent", {
    data: dataStack.exports,
  });
  const webhookStack = new SaborouWebhookStack(app, "TestWebhookStack", {
    data: dataStack.exports,
    api: apiStack.exports,
    agents: agentStack.exports,
  });
  return Template.fromStack(webhookStack);
}

describe("SaborouWebhookStack", () => {
  let template: Template;

  beforeAll(() => {
    template = buildTemplate();
  });

  test("Custom EventBus is created", () => {
    template.resourceCountIs("AWS::Events::EventBus", 1);
    template.hasResourceProperties("AWS::Events::EventBus", {
      Name: Match.stringLikeRegexp("saborou-event-bus"),
    });
  });

  test("EventBridge Rule is created for Slack events", () => {
    template.hasResourceProperties("AWS::Events::Rule", {
      EventPattern: {
        source: ["saborou.webhook"],
        "detail-type": ["SlackEvent"],
      },
    });
  });

  test("EventBridge Scheduler is created for background refresh", () => {
    template.resourceCountIs("AWS::Scheduler::Schedule", 1);
    template.hasResourceProperties("AWS::Scheduler::Schedule", {
      ScheduleExpression: "rate(1 hour)",
      State: "ENABLED",
    });
  });

  test("Webhook Lambda function is created with 10s timeout", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Timeout: 10,
      MemorySize: 256,
      Architectures: ["arm64"],
    });
  });
});
