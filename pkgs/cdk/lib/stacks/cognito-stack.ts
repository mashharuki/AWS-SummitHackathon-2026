import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { NagSuppressions } from "cdk-nag";
import type { Construct } from "constructs";

export interface CognitoStackExports {
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;
  readonly userPoolDomain: cognito.UserPoolDomain;
}

export interface CognitoStackProps extends cdk.StackProps {
  readonly frontendDomainName?: string;
  /**
   * パスキー（WebAuthn）の Relying Party ID。
   * CloudFront ドメイン（例: xxx.cloudfront.net）を指定する。
   * 再デプロイで CloudFront ドメインが変わった場合は更新して再デプロイが必要。
   * 未指定の場合はパスキー設定をスキップする。
   */
  readonly passkeyRelyingPartyId?: string;
}

export class SaborouCognitoStack extends cdk.Stack {
  public readonly exports: CognitoStackExports;

  constructor(scope: Construct, id: string, props?: CognitoStackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext("environment") ?? "dev";

    // --- ユーザープール ---
    // U-08: パスキー認証のために Essentials フィーチャープランを設定。
    // パスキー（WebAuthn）は Essentials 以上のフィーチャープランが必須。
    // コスト注記: Essentials は MAU 1,000 まで無料。ハッカソン規模では追加コストなし。
    // MAU 1,000 超過後は $0.0055/MAU の課金が発生する。
    // ref: https://aws.amazon.com/cognito/pricing/
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `saborou-user-pool-${environment}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
      },
      mfa: cognito.Mfa.OFF,
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
        requireUppercase: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deletionProtection: false,
      // U-08: Essentials フィーチャープラン（パスキー / マネージドログイン に必須）
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      // U-08: パスキー（WebAuthn）を許可（パスワードはフォールバックとして継続）
      ...(props?.passkeyRelyingPartyId
        ? {
            passkey: true,
            passkeyRelyingPartyId: props.passkeyRelyingPartyId,
            passkeyUserVerification: cognito.PasskeyUserVerification.PREFERRED,
          }
        : {}),
    });

    // --- ユーザープールクライアント ---
    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      userPoolClientName: `saborou-client-${environment}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
        // U-08: Choice-based 認証（USER_AUTH フロー）を有効化。
        // パスキー / パスワード / SRP を一元的に選択できるフローを有効にする。
        // Essentials フィーチャープランが必要。
        user: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          "http://localhost:5173/auth/callback",
          ...(props?.frontendDomainName
            ? [`https://${props.frontendDomainName}/auth/callback`]
            : []),
        ],
        logoutUrls: [
          "http://localhost:5173/login",
          ...(props?.frontendDomainName
            ? [`https://${props.frontendDomainName}/login`]
            : []),
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      generateSecret: false,
    });

    // --- Cognito マネージドログイン ドメイン ---
    // U-08: managedLoginVersion を NEWER_MANAGED_LOGIN (version 2) に設定。
    // パスキー選択 UI は Cognito マネージドログインが提供するため、
    // フロントエンド側の認可エンドポイント（/oauth2/authorize）への
    // リダイレクト方式は変わらない。
    const userPoolDomain = new cognito.UserPoolDomain(this, "UserPoolDomain", {
      userPool,
      cognitoDomain: {
        domainPrefix: `saborou-auth-${environment}`,
      },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    // --- CfnOutputs ---
    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
      description: "Cognito User Pool ID",
      exportName: `SaborouUserPoolId-${environment}`,
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
      exportName: `SaborouUserPoolClientId-${environment}`,
    });

    new cdk.CfnOutput(this, "CognitoDomainUrl", {
      value: `https://${userPoolDomain.domainName}.auth.ap-northeast-1.amazoncognito.com`,
      description: "Cognito Hosted UI Domain URL",
    });

    // --- cdk-nag 抑制 ---
    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-COG1",
        reason:
          "Password policy is intentionally relaxed for hackathon demo to reduce friction; not production hardening scope",
      },
      {
        id: "AwsSolutions-COG2",
        reason:
          "MFA is disabled for hackathon demo environment to simplify user experience",
      },
      {
        id: "AwsSolutions-COG3",
        reason:
          "AdvancedSecurityMode is disabled to reduce cost for hackathon scope",
      },
      {
        id: "AwsSolutions-COG8",
        reason:
          "Essentials tier is configured for passkey (WebAuthn) authentication and managed login; Plus tier advanced threat protection features are not required for hackathon scope",
      },
      {
        id: "AwsSolutions-IAM4",
        reason:
          "Managed policies used by CDK-generated custom resources for Cognito domain",
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Wildcard permissions used by CDK custom resource provider framework",
      },
      {
        id: "AwsSolutions-L1",
        reason: "CDK custom resource Lambda runtime managed by CDK framework",
      },
    ]);

    this.exports = { userPool, userPoolClient, userPoolDomain };
  }
}
