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
// --- Stack definitions (in dependency order) ---
// FrontendStack is instantiated before CognitoStack so its distributionDomainName
// CDK token can be forwarded to Cognito callbackUrls and API CORS allowOrigins.
// FrontendStack.apiUrl is declared in props but its CloudFront/S3 infrastructure
// does not use it at synth time, so passing the ApiStack token (created below) is safe.
const dataStack = new SaborouDataStack(app, `SaborouData-${environment}`, {
  env,
});

// Step 1: FrontendStack — produces distributionDomainName token
// apiUrl will be back-filled via Lazy once apiStack is synthesised.
let resolvedApiUrl = "";
const frontendStack = new SaborouFrontendStack(
  app,
  `SaborouFrontend-${environment}`,
  {
    env,
    apiUrl: cdk.Lazy.string({ produce: () => resolvedApiUrl }),
  },
);

// Step 2: CognitoStack — needs CloudFront domain for callbackUrls / logoutUrls
const cognitoStack = new SaborouCognitoStack(
  app,
  `SaborouCognito-${environment}`,
  {
    env,
    frontendDomainName: frontendStack.exports.distributionDomainName,
  },
);

// Step 3: ApiStack — needs Cognito exports; also forwards CloudFront domain for CORS
const apiStack = new SaborouApiStack(app, `SaborouApi-${environment}`, {
  env,
  cognito: cognitoStack.exports,
  data: dataStack.exports,
  frontendDomainName: frontendStack.exports.distributionDomainName,
});
resolvedApiUrl = apiStack.exports.httpApiUrl;

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

// --- cdk-nag: AWS Solutions Checks ---
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
