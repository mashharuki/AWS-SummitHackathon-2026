import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cr from "aws-cdk-lib/custom-resources";
import { NagSuppressions } from "cdk-nag";
import type { Construct } from "constructs";
import type { FrontendStackExports } from "./frontend-stack";

/**
 * ConfigDeployStack — フロントエンドのランタイム設定ファイルをデプロイする
 *
 * 循環依存を回避するため FrontendStack から分離。
 * FrontendStack (S3/CloudFront) + CognitoStack + ApiStack すべてが確定した後に
 * env-config.json を S3 に書き込む。
 *
 * BucketDeployment + Source.jsonData() ではなく cr.AwsCustomResource + S3.putObject を
 * 使用する理由: Source.jsonData() はシンセ時にファイルを書き込むため、
 * クロススタックの CDK トークンが CloudFormation Intrinsic 文字列のまま残り、
 * 実際の値に解決されない。AwsCustomResource の場合は Body が CloudFormation
 * パラメータとして渡され、Lambda 呼び出し前に CloudFormation が解決する。
 *
 * 依存関係:
 *   ConfigDeployStack → FrontendStack (bucket のみ — distribution は参照しない)
 *   ConfigDeployStack → CognitoStack (userPoolId, clientId, domain)
 *   ConfigDeployStack → ApiStack (httpApiUrl)
 */
export interface ConfigDeployStackProps extends cdk.StackProps {
  readonly frontend: FrontendStackExports;
  readonly apiUrl: string;
  readonly cognitoUserPoolId: string;
  readonly cognitoClientId: string;
  readonly cognitoDomain: string;
  readonly oauthRedirectUri: string;
}

export class SaborouConfigDeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ConfigDeployStackProps) {
    super(scope, id, props);

    // toJsonString() で CDK トークンを CloudFormation Intrinsics として埋め込む。
    // この文字列は CloudFormation が Lambda を呼び出す前に解決するため、
    // 実際の値が S3 に書き込まれる。
    const envConfigBody = cdk.Stack.of(this).toJsonString({
      VITE_API_BASE_URL: props.apiUrl,
      VITE_COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
      VITE_COGNITO_CLIENT_ID: props.cognitoClientId,
      VITE_COGNITO_DOMAIN: props.cognitoDomain,
      VITE_OAUTH_REDIRECT_URI: props.oauthRedirectUri,
    });

    const putConfig: cr.AwsSdkCall = {
      service: "S3",
      action: "putObject",
      parameters: {
        Bucket: props.frontend.bucket.bucketName,
        Key: "env-config.json",
        Body: envConfigBody,
        ContentType: "application/json",
        CacheControl: "no-store, max-age=0",
      },
      physicalResourceId: cr.PhysicalResourceId.of("saborou-env-config"),
    };

    new cr.AwsCustomResource(this, "PutEnvConfig", {
      onCreate: putConfig,
      onUpdate: putConfig,
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ["s3:PutObject"],
          resources: [`${props.frontend.bucket.bucketArn}/env-config.json`],
        }),
      ]),
    });

    // --- cdk-nag 抑制 ---
    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-IAM4",
        reason:
          "AwsCustomResource uses CDK-managed Lambda execution role with AWSLambdaBasicExecutionRole",
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "AwsCustomResource framework Lambda requires wildcard for CloudWatch Logs",
      },
      {
        id: "AwsSolutions-L1",
        reason:
          "AwsCustomResource Lambda runtime is managed by CDK framework",
      },
    ]);
  }
}
