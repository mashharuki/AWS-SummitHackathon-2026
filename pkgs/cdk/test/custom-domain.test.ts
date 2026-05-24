/**
 * custom-domain.test.ts
 *
 * URL 固定化（カスタムドメイン）の CDK テスト。
 * customDomain=false（デフォルト）と customDomain=true の両方を検証する。
 */
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { CUSTOM_DOMAIN } from "../lib/stacks/acm-us-east-1-stack";
import { SaborouApiStack } from "../lib/stacks/api-stack";
import { SaborouCognitoStack } from "../lib/stacks/cognito-stack";
import { SaborouDataStack } from "../lib/stacks/data-stack";
import { SaborouFrontendStack } from "../lib/stacks/frontend-stack";

// ----------------------------------------------------------------
// ヘルパー: ダミー証明書を import する（テスト用）
// ----------------------------------------------------------------
function fakeCertificate(scope: cdk.Stack, id: string): acm.ICertificate {
  return acm.Certificate.fromCertificateArn(
    scope,
    id,
    `arn:aws:acm:us-east-1:123456789012:certificate/${id}`,
  );
}

// ----------------------------------------------------------------
// customDomain=false（デフォルト）: 証明書なし・カスタムドメインなし
// ----------------------------------------------------------------
describe("SaborouFrontendStack — customDomain=false（デフォルト）", () => {
  let template: Template;
  let stack: SaborouFrontendStack;

  beforeAll(() => {
    const app = new cdk.App({ context: { environment: "test" } });
    stack = new SaborouFrontendStack(app, "TestFrontendDefault");
    template = Template.fromStack(stack);
  });

  test("カスタム証明書が設定されていないこと（ACM ARN なし）", () => {
    // カスタムドメインなしの場合、ViewerCertificate.AcmCertificateArn が存在しないこと
    const distributions = template.findResources(
      "AWS::CloudFront::Distribution",
    );
    const dist = Object.values(distributions)[0] as {
      Properties: {
        DistributionConfig: {
          ViewerCertificate?: { AcmCertificateArn?: string };
        };
      };
    };
    expect(
      dist.Properties.DistributionConfig.ViewerCertificate?.AcmCertificateArn,
    ).toBeUndefined();
  });

  test("domainNames が設定されていないこと（Aliases 要素なし）", () => {
    const distributions = template.findResources(
      "AWS::CloudFront::Distribution",
    );
    const dist = Object.values(distributions)[0] as {
      Properties: { DistributionConfig: { Aliases?: string[] } };
    };
    // Aliases が undefined または空配列であること
    expect(
      dist.Properties.DistributionConfig.Aliases ?? [],
    ).toHaveLength(0);
  });

  test("frontendUrl は CloudFront デフォルトドメイン（https://xxx.cloudfront.net）になること", () => {
    // frontendUrl は CloudFront の distributionDomainName を含む
    // CDK トークンが含まれるため、文字列が存在することだけ確認する
    expect(stack.exports.frontendUrl).toBeTruthy();
  });
});

// ----------------------------------------------------------------
// customDomain=true: CloudFront に証明書とカスタムドメインが設定される
// ----------------------------------------------------------------
describe("SaborouFrontendStack — customDomain=true", () => {
  let template: Template;
  let stack: SaborouFrontendStack;

  beforeAll(() => {
    const app = new cdk.App({ context: { environment: "test" } });
    // テスト用に dummy の us-east-1 証明書を import する
    // (実際は AcmUsEast1Stack から取得する)
    const tempStack = new cdk.Stack(app, "TempStack", {
      env: { region: "us-east-1", account: "123456789012" },
    });
    const cert = fakeCertificate(tempStack, "TestCert");

    stack = new SaborouFrontendStack(app, "TestFrontendCustom", {
      cloudfrontCertificate: cert,
      customDomainName: CUSTOM_DOMAIN.frontend,
    });
    template = Template.fromStack(stack);
  });

  test("CloudFront に ACM 証明書 ARN が設定されること", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        ViewerCertificate: {
          AcmCertificateArn:
            "arn:aws:acm:us-east-1:123456789012:certificate/TestCert",
          SslSupportMethod: "sni-only",
        },
      },
    });
  });

  test("CloudFront の Aliases にカスタムドメインが含まれること", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        Aliases: [CUSTOM_DOMAIN.frontend],
      },
    });
  });

  test("CloudFrontCnameDnsRecord の CfnOutput が出力されること", () => {
    const outputs = template.findOutputs("CloudFrontCnameDnsRecord");
    expect(Object.keys(outputs).length).toBe(1);
  });

  test("frontendUrl がカスタムドメインの https URL になること", () => {
    expect(stack.exports.frontendUrl).toBe(
      `https://${CUSTOM_DOMAIN.frontend}`,
    );
  });
});

// ----------------------------------------------------------------
// SaborouApiStack — customDomain=false（デフォルト）
// ----------------------------------------------------------------
describe("SaborouApiStack — customDomain=false（デフォルト）", () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App({ context: { environment: "test" } });
    const cognitoStack = new SaborouCognitoStack(app, "TestCognito2");
    const dataStack = new SaborouDataStack(app, "TestData2");
    const apiStack = new SaborouApiStack(app, "TestApiDefault", {
      cognito: cognitoStack.exports,
      data: dataStack.exports,
    });
    template = Template.fromStack(apiStack);
  });

  test("カスタムドメインリソースが作成されないこと", () => {
    // DomainName リソースは 0 個
    template.resourceCountIs("AWS::ApiGatewayV2::DomainName", 0);
  });

  test("ApiMapping リソースが作成されないこと", () => {
    template.resourceCountIs("AWS::ApiGatewayV2::ApiMapping", 0);
  });
});

// ----------------------------------------------------------------
// SaborouApiStack — customDomain=true
// ----------------------------------------------------------------
describe("SaborouApiStack — customDomain=true", () => {
  let template: Template;
  let apiStack: SaborouApiStack;

  beforeAll(() => {
    const app = new cdk.App({ context: { environment: "test" } });
    const cognitoStack = new SaborouCognitoStack(app, "TestCognito3");
    const dataStack = new SaborouDataStack(app, "TestData3");

    // テスト用ダミー証明書
    const certStack = new cdk.Stack(app, "CertStack3", {
      env: { region: "ap-northeast-1", account: "123456789012" },
    });
    const cert = fakeCertificate(certStack, "ApiTestCert");

    apiStack = new SaborouApiStack(app, "TestApiCustom", {
      cognito: cognitoStack.exports,
      data: dataStack.exports,
      apiCertificate: cert,
      customApiDomainName: CUSTOM_DOMAIN.api,
    });
    template = Template.fromStack(apiStack);
  });

  test("ApiGatewayV2::DomainName リソースが1つ作成されること", () => {
    template.resourceCountIs("AWS::ApiGatewayV2::DomainName", 1);
  });

  test("DomainName にカスタムドメインが設定されること", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::DomainName", {
      DomainName: CUSTOM_DOMAIN.api,
    });
  });

  test("ApiGatewayV2::ApiMapping リソースが1つ作成されること", () => {
    template.resourceCountIs("AWS::ApiGatewayV2::ApiMapping", 1);
  });

  test("ApiCnameDnsRecord の CfnOutput が出力されること", () => {
    const outputs = template.findOutputs("ApiCnameDnsRecord");
    expect(Object.keys(outputs).length).toBe(1);
  });

  test("apiUrl がカスタムドメインの https URL になること", () => {
    expect(apiStack.exports.apiUrl).toBe(`https://${CUSTOM_DOMAIN.api}`);
  });

  test("DomainName に TLS_1_2 セキュリティポリシーが設定されること", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::DomainName", {
      DomainNameConfigurations: [
        {
          SecurityPolicy: "TLS_1_2",
        },
      ],
    });
  });
});

// ----------------------------------------------------------------
// AcmUsEast1Stack
// ----------------------------------------------------------------
describe("AcmUsEast1Stack", () => {
  let template: Template;

  beforeAll(() => {
    const { AcmUsEast1Stack } = require("../lib/stacks/acm-us-east-1-stack");
    const app = new cdk.App({ context: { environment: "test" } });
    const stack = new AcmUsEast1Stack(app, "TestAcmUsEast1", {
      env: { region: "us-east-1", account: "123456789012" },
    });
    template = Template.fromStack(stack);
  });

  test("ACM 証明書リソースが1つ作成されること", () => {
    template.resourceCountIs("AWS::CertificateManager::Certificate", 1);
  });

  test("証明書のドメイン名が saborou.agentic-jp.com であること", () => {
    template.hasResourceProperties(
      "AWS::CertificateManager::Certificate",
      {
        DomainName: CUSTOM_DOMAIN.frontend,
      },
    );
  });

  test("証明書の検証方法が DNS であること", () => {
    template.hasResourceProperties(
      "AWS::CertificateManager::Certificate",
      {
        ValidationMethod: "DNS",
      },
    );
  });

  test("CloudFrontCertificateArn の CfnOutput が存在すること", () => {
    const outputs = template.findOutputs("CloudFrontCertificateArn");
    expect(Object.keys(outputs).length).toBe(1);
  });
});
