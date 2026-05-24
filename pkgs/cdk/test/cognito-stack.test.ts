import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { SaborouCognitoStack } from "../lib/stacks/cognito-stack";

const TEST_RELYING_PARTY_ID = "test.cloudfront.net";

function buildTemplate(passkeyRelyingPartyId?: string): Template {
  const app = new cdk.App({ context: { environment: "test" } });
  const stack = new SaborouCognitoStack(app, "TestCognitoStack", {
    passkeyRelyingPartyId,
  });
  return Template.fromStack(stack);
}

describe("SaborouCognitoStack", () => {
  let template: Template;
  let templateWithPasskey: Template;

  beforeAll(() => {
    template = buildTemplate();
    templateWithPasskey = buildTemplate(TEST_RELYING_PARTY_ID);
  });

  test("UserPool is created with email sign-in and self-signup enabled", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      UsernameAttributes: Match.arrayWith(["email"]),
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: false,
      },
    });
  });

  test("UserPool has correct password policy", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireLowercase: true,
          RequireNumbers: true,
        },
      },
    });
  });

  test("UserPool has RETAIN removal policy", () => {
    template.hasResource("AWS::Cognito::UserPool", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
  });

  test("Cognito managed login domain is created with NEWER_MANAGED_LOGIN version", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolDomain", {
      Domain: Match.stringLikeRegexp("saborou-auth-test"),
      ManagedLoginVersion: 2,
    });
  });

  test("UserPoolClient is created with AuthorizationCodeGrant flow", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      AllowedOAuthFlows: Match.arrayWith(["code"]),
      SupportedIdentityProviders: Match.arrayWith(["COGNITO"]),
    });
  });

  // U-08: Essentials フィーチャープランのテスト
  test("UserPool has ESSENTIALS feature plan for passkey support", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      UserPoolTier: "ESSENTIALS",
    });
  });

  // U-08: Choice-based 認証フロー（USER_AUTH / ALLOW_USER_AUTH）のテスト
  test("UserPoolClient has ALLOW_USER_AUTH explicit auth flow for choice-based authentication", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      ExplicitAuthFlows: Match.arrayWith(["ALLOW_USER_AUTH"]),
    });
  });

  // U-08: choice-based 認証で password（フォールバック）＋ passkey を許可
  test("UserPool allows password and passkey as first auth factors", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      Policies: {
        SignInPolicy: {
          AllowedFirstAuthFactors: Match.arrayWith(["PASSWORD", "WEB_AUTHN"]),
        },
      },
    });
  });

  // U-08: パスキー（WebAuthn）は RP ID 指定の有無に関わらず常に有効。
  // user verification は preferred。
  test("UserPool enables passkey with PREFERRED user verification by default", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      WebAuthnUserVerification: "preferred",
    });
  });

  // U-08: RP ID は明示指定しない（prefix domain を Cognito が自動採用）ため
  // WebAuthnRelyingPartyID は出力されないことを確認。
  test("UserPool does not set an explicit WebAuthn relying party ID by default", () => {
    const resources = template.findResources("AWS::Cognito::UserPool");
    const poolProps = Object.values(resources)[0]?.Properties as
      | Record<string, unknown>
      | undefined;
    expect(poolProps?.WebAuthnRelyingPartyID).toBeUndefined();
  });

  // U-08: passkeyRelyingPartyId を明示指定した場合はその値が設定される
  // （将来 Cognito にカスタムドメインを割り当てる場合の経路）
  test("UserPool sets passkey relying party ID when explicitly provided", () => {
    templateWithPasskey.hasResourceProperties("AWS::Cognito::UserPool", {
      WebAuthnRelyingPartyID: TEST_RELYING_PARTY_ID,
      WebAuthnUserVerification: "preferred",
    });
  });
});
