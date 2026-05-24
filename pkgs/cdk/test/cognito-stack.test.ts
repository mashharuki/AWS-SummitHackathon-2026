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

  // U-08: パスキー RP ID が設定される場合のテスト
  test("UserPool has passkey relying party ID when passkeyRelyingPartyId is provided", () => {
    templateWithPasskey.hasResourceProperties("AWS::Cognito::UserPool", {
      WebAuthnRelyingPartyID: TEST_RELYING_PARTY_ID,
      WebAuthnUserVerification: "preferred",
    });
  });

  // U-08: passkeyRelyingPartyId 未設定時はパスキープロパティが存在しないことを確認
  test("UserPool does not set WebAuthn properties when passkeyRelyingPartyId is not provided", () => {
    const resources = template.findResources("AWS::Cognito::UserPool");
    const poolProps = Object.values(resources)[0]?.Properties as
      | Record<string, unknown>
      | undefined;
    expect(poolProps?.WebAuthnRelyingPartyID).toBeUndefined();
  });
});
