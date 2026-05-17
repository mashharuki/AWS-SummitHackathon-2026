import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { SaborouCognitoStack } from "../lib/stacks/cognito-stack";

function buildTemplate(): Template {
  const app = new cdk.App({ context: { environment: "test" } });
  const stack = new SaborouCognitoStack(app, "TestCognitoStack");
  return Template.fromStack(stack);
}

describe("SaborouCognitoStack", () => {
  let template: Template;

  beforeAll(() => {
    template = buildTemplate();
  });

  test("UserPool is created with email sign-in and no self-signup", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      UsernameAttributes: Match.arrayWith(["email"]),
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: true,
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

  test("Cognito Hosted UI domain is created", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolDomain", {
      Domain: Match.stringLikeRegexp("saborou-auth-test"),
    });
  });

  test("UserPoolClient is created with AuthorizationCodeGrant flow", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      AllowedOAuthFlows: Match.arrayWith(["code"]),
      SupportedIdentityProviders: Match.arrayWith(["Google"]),
    });
  });
});
