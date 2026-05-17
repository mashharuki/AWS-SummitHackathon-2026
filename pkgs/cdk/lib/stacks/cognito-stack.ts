import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { NagSuppressions } from "cdk-nag";
import type { Construct } from "constructs";

export interface CognitoStackExports {
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;
  readonly userPoolDomain: cognito.UserPoolDomain;
}

export interface CognitoStackProps extends cdk.StackProps {
  readonly frontendDomainName?: string;
}

export class SaborouCognitoStack extends cdk.Stack {
  public readonly exports: CognitoStackExports;

  constructor(scope: Construct, id: string, props?: CognitoStackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext("environment") ?? "dev";

    // --- ユーザープール ---
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `saborou-user-pool-${environment}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
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
    });

    // --- Google IdP ---
    const googleClientId = ssm.StringParameter.valueForStringParameter(
      this,
      "/saborou/google/client-id",
    );

    const googleClientSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "GoogleSecret",
      "/saborou/google/client-secret",
    );

    const googleIdP = new cognito.UserPoolIdentityProviderGoogle(
      this,
      "GoogleIdP",
      {
        userPool,
        clientId: googleClientId,
        clientSecretValue: googleClientSecret.secretValue,
        scopes: ["openid", "email", "profile"],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        },
      },
    );

    // --- ユーザープールクライアント ---
    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      userPoolClientName: `saborou-client-${environment}`,
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
          "http://localhost:5173",
          ...(props?.frontendDomainName
            ? [`https://${props.frontendDomainName}`]
            : []),
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      generateSecret: false,
    });
    userPoolClient.node.addDependency(googleIdP);

    // --- Cognito ホスト型 UI ドメイン ---
    const userPoolDomain = new cognito.UserPoolDomain(this, "UserPoolDomain", {
      userPool,
      cognitoDomain: {
        domainPrefix: `saborou-auth-${environment}`,
      },
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
          "Plus tier is not required for hackathon demo; standard security is sufficient",
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
