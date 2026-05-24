#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Aspects } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { SaborouAgentStack } from "../lib/stacks/agent-stack";
import { SaborouApiStack } from "../lib/stacks/api-stack";
import { SaborouCognitoStack } from "../lib/stacks/cognito-stack";
import { SaborouConfigDeployStack } from "../lib/stacks/config-deploy-stack";
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

// --- Stack definitions (依存順) ---
//
// 依存グラフ (循環なし):
//   FrontendStack  (依存なし)
//   CognitoStack   → FrontendStack.distributionDomainName
//   DataStack      (依存なし)
//   ApiStack       → CognitoStack, DataStack, FrontendStack.distributionDomainName
//   AgentStack     → DataStack
//   WebhookStack   → DataStack, ApiStack, AgentStack
//   ConfigDeployStack → FrontendStack(bucket/distribution), CognitoStack, ApiStack
//
// ConfigDeployStack を最後に置くことで、すべての CDK トークンが解決済みの状態で
// env-config.json を S3 に書き込める。

const dataStack = new SaborouDataStack(app, `SaborouData-${environment}`, {
  env,
});

// Step 1: FrontendStack — S3 バケットと CloudFront を作成。他スタックへの依存なし。
const frontendStack = new SaborouFrontendStack(
  app,
  `SaborouFrontend-${environment}`,
  { env },
);

// Step 2: CognitoStack — CloudFront ドメインを callbackUrls / logoutUrls に使用
// U-08: passkeyRelyingPartyId は Cognito Managed Login ドメインを指定する。
// WebAuthn の RP ID はパスキー UI が提供されるページの origin と一致する必要があり、
// Managed Login (v2) ではそれは Cognito のホスト型ドメインになる。
// CloudFront ドメインをここに使うと RP ID mismatch エラーが発生する。
const cognitoDomainHostname = `saborou-auth-${environment}.auth.ap-northeast-1.amazoncognito.com`;
const cognitoStack = new SaborouCognitoStack(
  app,
  `SaborouCognito-${environment}`,
  {
    env,
    frontendDomainName: frontendStack.exports.distributionDomainName,
    passkeyRelyingPartyId: cognitoDomainHostname,
  },
);

// Step 3: ApiStack — Cognito + DataStack + CloudFront ドメイン (CORS) を使用
const apiStack = new SaborouApiStack(app, `SaborouApi-${environment}`, {
  env,
  cognito: cognitoStack.exports,
  data: dataStack.exports,
  frontendDomainName: frontendStack.exports.distributionDomainName,
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

// Step 4: ConfigDeployStack — FrontendStack・CognitoStack・ApiStack のすべてが
// 確定した後に env-config.json を S3 へ書き込む。循環依存を回避するため分離。
new SaborouConfigDeployStack(app, `SaborouConfigDeploy-${environment}`, {
  env,
  frontend: frontendStack.exports,
  apiUrl: apiStack.exports.httpApiUrl,
  cognitoUserPoolId: cognitoStack.exports.userPool.userPoolId,
  cognitoClientId: cognitoStack.exports.userPoolClient.userPoolClientId,
  cognitoDomain: `https://${cognitoStack.exports.userPoolDomain.domainName}.auth.ap-northeast-1.amazoncognito.com`,
  oauthRedirectUri: `https://${frontendStack.exports.distributionDomainName}/auth/callback`,
});

// --- cdk-nag: AWS Solutions Checks ---
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
