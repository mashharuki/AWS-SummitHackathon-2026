#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Aspects } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { AwsSolutionsChecks } from "cdk-nag";
import {
  AcmUsEast1Stack,
  CUSTOM_DOMAIN,
} from "../lib/stacks/acm-us-east-1-stack";
import { SaborouAgentStack } from "../lib/stacks/agent-stack";
import { SaborouApiStack } from "../lib/stacks/api-stack";
import { SaborouCognitoStack } from "../lib/stacks/cognito-stack";
import { SaborouConfigDeployStack } from "../lib/stacks/config-deploy-stack";
import { SaborouDataStack } from "../lib/stacks/data-stack";
import { SaborouFrontendStack } from "../lib/stacks/frontend-stack";
import { SaborouWebhookStack } from "../lib/stacks/webhook-stack";

const app = new cdk.App();
const environment = app.node.tryGetContext("environment") ?? "dev";

// -c customDomain=true で URL 固定化（カスタムドメイン）を有効化する。
// デフォルト false のため既存挙動は維持される。
const useCustomDomain =
  (app.node.tryGetContext("customDomain") as string | undefined) === "true";

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
//   [customDomain=true のみ]
//   AcmUsEast1Stack   (us-east-1, 依存なし) ← CloudFront 証明書
//   AcmApiStack       (ap-northeast-1, 依存なし) ← API 証明書（インライン）
//
//   FrontendStack  (依存なし / customDomain=true 時は AcmUsEast1Stack.certificate を受け取る)
//   CognitoStack   → FrontendStack.distributionDomainName
//   DataStack      (依存なし)
//   ApiStack       → CognitoStack, DataStack, FrontendStack.distributionDomainName
//                    customDomain=true 時は apiCertificate も受け取る
//   AgentStack     → DataStack
//   WebhookStack   → DataStack, ApiStack, AgentStack
//   ConfigDeployStack → FrontendStack(bucket/distribution), CognitoStack, ApiStack
//
// ConfigDeployStack を最後に置くことで、すべての CDK トークンが解決済みの状態で
// env-config.json を S3 に書き込める。

// --- [customDomain=true] Step 0: us-east-1 証明書スタック ---
// CloudFront 証明書は us-east-1 必須。crossRegionReferences で ap-northeast-1 から参照する。
// Route53 を使わないため DNS 検証は手動（Cloudflare に CNAME を登録してから deploy）。
let cloudfrontCertificate: acm.ICertificate | undefined;
let apiCertificate: acm.ICertificate | undefined;

if (useCustomDomain) {
  // CloudFront 用証明書（us-east-1）
  const acmUsEast1Stack = new AcmUsEast1Stack(
    app,
    `SaborouAcmUsEast1-${environment}`,
    {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: "us-east-1",
      },
      crossRegionReferences: true,
    },
  );
  cloudfrontCertificate = acmUsEast1Stack.exports.cloudfrontCertificate;

  // API Gateway 用証明書（ap-northeast-1）
  // AcmUsEast1Stack とは別スタックにしてもよいが、ap-northeast-1 なのでインラインに作れる。
  // ただしスタックをまたいだ方が destroy 時の順序制御が明確になるため、ApiCert スタックを分離する。
  const acmApiStack = new cdk.Stack(app, `SaborouAcmApi-${environment}`, {
    env,
    description: "API Gateway カスタムドメイン用 ACM 証明書（ap-northeast-1）",
  });
  const apiCert = new acm.Certificate(acmApiStack, "ApiCertificate", {
    domainName: CUSTOM_DOMAIN.api,
    validation: acm.CertificateValidation.fromDns(),
    certificateName: `saborou-api-${environment}`,
  });
  new cdk.CfnOutput(acmApiStack, "ApiCertificateArn", {
    value: apiCert.certificateArn,
    description: "[API証明書ARN] ApiStack の apiCertificate パラメータに使用",
  });
  new cdk.CfnOutput(acmApiStack, "ApiAcmDnsValidationNote", {
    value: `ACM コンソール (ap-northeast-1) で証明書 ${CUSTOM_DOMAIN.api} の検証 CNAME を確認し Cloudflare に登録。Proxy OFF (DNS only) にすること。`,
    description: "API 用 ACM DNS 検証 CNAME 登録方法",
  });
  apiCertificate = apiCert;
}

const dataStack = new SaborouDataStack(app, `SaborouData-${environment}`, {
  env,
});

// Step 1: FrontendStack — S3 バケットと CloudFront を作成。他スタックへの依存なし。
// customDomain=true 時は us-east-1 証明書とカスタムドメイン名を渡す。
const frontendStack = new SaborouFrontendStack(
  app,
  `SaborouFrontend-${environment}`,
  {
    env,
    cloudfrontCertificate,
    customDomainName: useCustomDomain ? CUSTOM_DOMAIN.frontend : undefined,
  },
);

// Step 2: CognitoStack — CloudFront / 固定ドメインを callbackUrls / logoutUrls に使用
// U-08: passkeyRelyingPartyId は明示指定しない。
// Cognito を prefix domain（saborou-auth-<env>.auth.<region>.amazoncognito.com）で運用する場合、
// Managed Login (v2) では Cognito が自動的にその prefix domain を RP ID に採用する。
// amazoncognito.com は AWS の予約ドメインのため、UserPool 作成時に明示指定すると
// "RelyingPartyId cannot be reserved domain" エラーで失敗する。
// （将来 Cognito にカスタムドメインを割り当てる場合のみ、そのドメインを RP ID に指定する）

// カスタムドメイン有効時は固定の https://saborou.agentic-jp.com を使用する。
// 無効時は CloudFront デフォルトドメインを使用する。
const frontendDomainForCognito = useCustomDomain
  ? CUSTOM_DOMAIN.frontend
  : frontendStack.exports.distributionDomainName;

const cognitoStack = new SaborouCognitoStack(
  app,
  `SaborouCognito-${environment}`,
  {
    env,
    frontendDomainName: frontendDomainForCognito,
  },
);

// Step 3: ApiStack — Cognito + DataStack + CloudFront ドメイン (CORS) を使用
// カスタムドメイン有効時は固定の https://saborou.agentic-jp.com を CORS に含める。
const frontendDomainForApi = useCustomDomain
  ? CUSTOM_DOMAIN.frontend
  : frontendStack.exports.distributionDomainName;

const apiStack = new SaborouApiStack(app, `SaborouApi-${environment}`, {
  env,
  cognito: cognitoStack.exports,
  data: dataStack.exports,
  frontendDomainName: frontendDomainForApi,
  apiCertificate,
  customApiDomainName: useCustomDomain ? CUSTOM_DOMAIN.api : undefined,
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
// カスタムドメイン有効時は固定 URL を使用する。
const configApiUrl = useCustomDomain
  ? `https://${CUSTOM_DOMAIN.api}`
  : apiStack.exports.httpApiUrl;

const configFrontendUrl = useCustomDomain
  ? `https://${CUSTOM_DOMAIN.frontend}`
  : `https://${frontendStack.exports.distributionDomainName}`;

const configOauthRedirectUri = useCustomDomain
  ? `https://${CUSTOM_DOMAIN.frontend}/auth/callback`
  : `https://${frontendStack.exports.distributionDomainName}/auth/callback`;

new SaborouConfigDeployStack(app, `SaborouConfigDeploy-${environment}`, {
  env,
  frontend: frontendStack.exports,
  apiUrl: configApiUrl,
  cognitoUserPoolId: cognitoStack.exports.userPool.userPoolId,
  cognitoClientId: cognitoStack.exports.userPoolClient.userPoolClientId,
  cognitoDomain: `https://${cognitoStack.exports.userPoolDomain.domainName}.auth.ap-northeast-1.amazoncognito.com`,
  oauthRedirectUri: configOauthRedirectUri,
});

// --- cdk-nag: AWS Solutions Checks ---
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
