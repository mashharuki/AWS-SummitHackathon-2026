import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { NagSuppressions } from "cdk-nag";
import type { Construct } from "constructs";
import * as path from "node:path";

// 他スタックへの依存を持たないシンプルなProps
export type FrontendStackProps = cdk.StackProps;

export interface FrontendStackExports {
  readonly distributionDomainName: string;
  readonly bucketName: string;
  // ConfigDeployStack が env-config.json を書き込むために使用
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;
}

export class SaborouFrontendStack extends cdk.Stack {
  public readonly exports: FrontendStackExports;

  constructor(scope: Construct, id: string, props?: FrontendStackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext("environment") ?? "dev";

    // --- S3 バケット (プライベート, OAC) ---
    const bucket = new s3.Bucket(this, "FrontendBucket", {
      bucketName: `saborou-frontend-${this.account}-${environment}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // --- OAC 付き CloudFront ディストリビューション ---
    // origin を一度生成して default と additionalBehaviors で共有し、OAC が重複しないようにする
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        compress: true,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      comment: `Saborou Frontend Distribution (${environment})`,
      enableLogging: false,
      additionalBehaviors: {
        // env-config.json はランタイム設定のため CloudFront キャッシュを無効化する
        "/env-config.json": {
          origin: s3Origin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          compress: false,
        },
      },
    });

    // --- ビルド済みフロントエンドアセットを S3 に同期 ---
    // env-config.json は ConfigDeployStack が別途デプロイするため除外する
    new s3deploy.BucketDeployment(this, "DeployFrontendAssets", {
      sources: [
        s3deploy.Source.asset(
          path.join(__dirname, "../../../frontend/dist"),
        ),
      ],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ["/*"],
      prune: true,
      memoryLimit: 512,
      exclude: ["env-config.json"],
    });

    // --- CfnOutputs ---
    new cdk.CfnOutput(this, "CloudFrontDomainName", {
      value: distribution.distributionDomainName,
      description: "CloudFront Distribution domain name",
      exportName: `SaborouCloudFrontDomain-${environment}`,
    });

    new cdk.CfnOutput(this, "S3BucketName", {
      value: bucket.bucketName,
      description: "S3 bucket name for frontend assets",
    });

    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
      description: "CloudFront Distribution ID (for cache invalidation)",
    });

    // --- cdk-nag 抑制 ---
    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-S1",
        reason:
          "S3 server access logging is disabled to reduce cost for hackathon scope",
      },
      {
        id: "AwsSolutions-CFR1",
        reason:
          "CloudFront access logging is disabled to reduce cost for hackathon scope",
      },
      {
        id: "AwsSolutions-CFR2",
        reason:
          "WAF integration is not required for hackathon demo; not a production hardening requirement",
      },
      {
        id: "AwsSolutions-CFR3",
        reason:
          "CloudFront access logging is disabled to reduce cost for hackathon scope",
      },
      {
        id: "AwsSolutions-CFR4",
        reason:
          "TLS 1.2 minimum is enforced by default CloudFront security policy; no custom certificate for hackathon",
      },
      {
        id: "AwsSolutions-IAM4",
        reason:
          "Auto-delete objects and BucketDeployment custom resources use managed policies; CDK-generated",
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Auto-delete and BucketDeployment custom resources require S3 wildcard to operate",
      },
      {
        id: "AwsSolutions-L1",
        reason:
          "Auto-delete objects and BucketDeployment Lambda runtimes are managed by CDK framework",
      },
    ]);

    this.exports = {
      distributionDomainName: distribution.distributionDomainName,
      bucketName: bucket.bucketName,
      bucket,
      distribution,
    };
  }
}
