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

/**
 * Congnito Stack — ユーザープールとマネージドログインのスタック
 */
export class SaborouCognitoStack extends cdk.Stack {
  public readonly exports: CognitoStackExports;

  /**
   * コンストラクター
   * @param scope
   * @param id
   * @param props
   */
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
      // U-08: choice-based 認証で「パスワード（フォールバック）＋パスキー」を許可する。
      // password は必須（true 固定）。passkey を加えることでパスワードを残したまま
      // パスキー（WebAuthn）も選べる。
      signInPolicy: {
        allowedFirstAuthFactors: {
          password: true,
          passkey: true,
        },
      },
      // RP ID は明示指定しない。マネージドログイン構成では Cognito が自動的に
      // prefix domain（saborou-auth-<env>.auth.<region>.amazoncognito.com）を RP ID に採用する。
      // ※ amazoncognito.com は AWS の予約ドメインのため、UserPool 作成時に
      //   passkeyRelyingPartyId として明示指定すると "RelyingPartyId cannot be reserved domain" で失敗する。
      //   カスタムドメインを Cognito に割り当てる場合のみ passkeyRelyingPartyId にそのドメインを指定する。
      passkeyUserVerification: cognito.PasskeyUserVerification.PREFERRED,
      ...(props?.passkeyRelyingPartyId
        ? { passkeyRelyingPartyId: props.passkeyRelyingPartyId }
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
          // Chrome 拡張（Side Panel）の固定 Extension ID のコールバック。
          // manifest.json の固定 key により全員同一 ID になる。
          // 追加 ID は context extensionIds（カンマ区切り）で渡せる。
          "https://klnbcafcphlnmbdbjgmpdjfeimenokmj.chromiumapp.org/",
          ...extensionCallbackUrls(this),
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

    // --- マネージドログイン ブランディング ---
    // U-08: managedLoginVersion v2 はブランディングスタイルが存在しないと
    // ログインページが "Login pages unavailable" になり表示できない。
    // Cognito 提供のデフォルト値（useCognitoProvidedValues）でスタイルを作成する。
    const managedLoginBranding = new cognito.CfnManagedLoginBranding(
      this,
      "ManagedLoginBranding",
      {
        userPoolId: userPool.userPoolId,
        clientId: userPoolClient.userPoolClientId,
        useCognitoProvidedValues: true,
      },
    );
    // UserPoolDomain（v2 ドメイン）の後に作成されるよう依存を明示する。
    managedLoginBranding.node.addDependency(userPoolDomain);

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

/**
 * context の extensionIds（カンマ区切りの Chrome 拡張 ID）を
 * Cognito コールバック URL（https://<id>.chromiumapp.org/）に変換する。
 * 例: cdk deploy ... -c extensionIds=abc123,def456
 */
function extensionCallbackUrls(scope: Construct): string[] {
  const raw = (scope.node.tryGetContext("extensionIds") as string) ?? "";
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => `https://${id}.chromiumapp.org/`);
}
