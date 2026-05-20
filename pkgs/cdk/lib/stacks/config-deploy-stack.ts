import * as cdk from "aws-cdk-lib";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
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
 * 依存関係:
 *   ConfigDeployStack → FrontendStack (bucket, distribution)
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

    // CDK トークンは Source.jsonData() → Stack.toJsonString() 経由で
    // CloudFormation が解決してから Lambda に渡されるため実際の値が書き込まれる
    new s3deploy.BucketDeployment(this, "DeployEnvConfig", {
      sources: [
        s3deploy.Source.jsonData("env-config.json", {
          VITE_API_BASE_URL: props.apiUrl,
          VITE_COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
          VITE_COGNITO_CLIENT_ID: props.cognitoClientId,
          VITE_COGNITO_DOMAIN: props.cognitoDomain,
          VITE_OAUTH_REDIRECT_URI: props.oauthRedirectUri,
        }),
      ],
      destinationBucket: props.frontend.bucket,
      distribution: props.frontend.distribution,
      distributionPaths: ["/env-config.json"],
      prune: false,
      memoryLimit: 128,
    });

    // --- cdk-nag 抑制 ---
    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-IAM4",
        reason:
          "BucketDeployment custom resource uses CDK-managed Lambda execution role",
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "BucketDeployment custom resource requires S3 wildcard for cross-stack bucket access",
      },
      {
        id: "AwsSolutions-L1",
        reason:
          "BucketDeployment Lambda runtime is managed by CDK framework",
      },
    ]);
  }
}
