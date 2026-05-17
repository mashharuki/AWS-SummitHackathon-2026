#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Aspects } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { SaborouAgentStack } from "../lib/stacks/agent-stack";
import { SaborouApiStack } from "../lib/stacks/api-stack";
import { SaborouCognitoStack } from "../lib/stacks/cognito-stack";
import { SaborouDataStack } from "../lib/stacks/data-stack";
import { SaborouFrontendStack } from "../lib/stacks/frontend-stack";
import { SaborouWebhookStack } from "../lib/stacks/webhook-stack";

const app = new cdk.App();
const environment = app.node.tryGetContext("environment") ?? "dev";

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: "ap-northeast-1",
};

// --- Global tags ---
cdk.Tags.of(app).add("Project", "saborou");
cdk.Tags.of(app).add("ManagedBy", "aws-cdk");
cdk.Tags.of(app).add("Environment", environment);

// --- Stack definitions (in dependency order) ---
const cognitoStack = new SaborouCognitoStack(
  app,
  `SaborouCognito-${environment}`,
  { env },
);

const dataStack = new SaborouDataStack(app, `SaborouData-${environment}`, {
  env,
});

const apiStack = new SaborouApiStack(app, `SaborouApi-${environment}`, {
  env,
  cognito: cognitoStack.exports,
  data: dataStack.exports,
});

const agentStack = new SaborouAgentStack(app, `SaborouAgent-${environment}`, {
  env,
  data: dataStack.exports,
});

new SaborouWebhookStack(app, `SaborouWebhook-${environment}`, {
  env,
  data: dataStack.exports,
  api: apiStack.exports,
  agents: agentStack.exports,
});

new SaborouFrontendStack(app, `SaborouFrontend-${environment}`, {
  env,
  apiUrl: apiStack.exports.httpApiUrl,
});

// --- cdk-nag: AWS Solutions Checks ---
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
