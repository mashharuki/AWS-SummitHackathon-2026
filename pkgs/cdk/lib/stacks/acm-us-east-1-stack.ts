/**
 * AcmUsEast1Stack — CloudFront 用 ACM 証明書（us-east-1 専用スタック）
 *
 * CloudFront にカスタムドメインを設定するには、証明書が必ず us-east-1 に存在する必要がある。
 * このスタックは us-east-1 に配置し、crossRegionReferences: true を使って
 * ap-northeast-1 の FrontendStack からクロスリージョン参照させる。
 *
 * Cloudflare DNS を使用するため Route53 HostedZone は不要。
 * CertificateValidation.fromDns()（引数なし）で手動 DNS 検証とし、
 * 検証用 CNAME を CfnOutput に出力する。
 * ユーザーは CDK synth 後に Cloudflare へ CNAME を登録してから `cdk deploy` を実行する。
 *
 * 使用条件: context フラグ `customDomain=true` のときのみ bin/cdk.ts からインスタンス化される。
 */
import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { NagSuppressions } from "cdk-nag";
import type { Construct } from "constructs";

/** カスタムドメイン設定（Cloudflare 管理の agentic-jp.com） */
export const CUSTOM_DOMAIN = {
  /** フロント(CloudFront)用サブドメイン */
  frontend: "saborou.agentic-jp.com",
  /** API(HTTP API)用サブドメイン */
  api: "saborou-api.agentic-jp.com",
  /** 親ドメイン */
  root: "agentic-jp.com",
} as const;

export interface AcmUsEast1StackExports {
  /** CloudFront 用証明書（us-east-1）*/
  readonly cloudfrontCertificate: acm.ICertificate;
}

export class AcmUsEast1Stack extends cdk.Stack {
  public readonly exports: AcmUsEast1StackExports;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    // crossRegionReferences: true を必ず設定する。
    // これにより CDK が SSM Parameter Store を仲介して us-east-1 の値を
    // ap-northeast-1 スタックへクロスリージョン参照できるようにする。
    super(scope, id, {
      ...props,
      crossRegionReferences: true,
    });

    // CloudFront 用証明書（us-east-1）
    // Route53 HostedZone を指定しないため手動 DNS 検証となる。
    // CDK synth 後に CloudFormation コンソールまたは CfnOutput から
    // 検証用 CNAME(Name/Value) を確認し、Cloudflare へ登録する。
    // 登録完了後に `cdk deploy` を実行することで証明書が発行される。
    const cloudfrontCert = new acm.Certificate(this, "CloudFrontCertificate", {
      domainName: CUSTOM_DOMAIN.frontend,
      validation: acm.CertificateValidation.fromDns(),
      certificateName: `saborou-cloudfront-${this.node.tryGetContext("environment") ?? "dev"}`,
    });

    // --- CfnOutputs ---
    // ユーザーが Cloudflare に登録すべきレコードを出力する。
    // 証明書検証 CNAME は ACM コンソールで確認してください（CDK からは取得不可）。
    new cdk.CfnOutput(this, "CloudFrontCertificateArn", {
      value: cloudfrontCert.certificateArn,
      description:
        "[CloudFront用証明書ARN] FrontendStack の certificate パラメータに使用される",
    });

    new cdk.CfnOutput(this, "AcmDnsValidationNote", {
      value: `ACM コンソール (us-east-1) で証明書 ${CUSTOM_DOMAIN.frontend} の検証 CNAME (Name / Value) を確認し、Cloudflare DNS に登録してください。Proxy は OFF（DNS only）にすること。`,
      description: "ACM DNS 検証 CNAME の登録方法",
    });

    new cdk.CfnOutput(this, "CloudFrontCnameDnsNote", {
      value: `Cloudflare に CNAME レコードを追加: ${CUSTOM_DOMAIN.frontend} → <CloudFrontDistributionDomainName>.cloudfront.net  (Proxy OFF / DNS only)`,
      description:
        "[手動] CloudFront 向け CNAME レコード（FrontendStack deploy 後に取得できる値を使用）",
    });

    // cdk-nag 抑制（証明書リソース自体には特別な抑制は不要）
    NagSuppressions.addStackSuppressions(this, []);

    this.exports = {
      cloudfrontCertificate: cloudfrontCert,
    };
  }
}
