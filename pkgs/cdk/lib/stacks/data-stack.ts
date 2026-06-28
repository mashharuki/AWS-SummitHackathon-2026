import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as cr from "aws-cdk-lib/custom-resources";
import { NagSuppressions } from "cdk-nag";
import type { Construct } from "constructs";

export interface DataStackExports {
  readonly tables: {
    readonly users: dynamodb.Table;
    readonly connections: dynamodb.Table;
    readonly taskCandidates: dynamodb.Table;
    readonly tasks: dynamodb.Table;
    readonly proposals: dynamodb.Table;
    readonly honneData: dynamodb.Table;
    readonly personas: dynamodb.Table;
    /** Google Calendar 手動取り込みキャッシュ（U-07b / BR-G-03） */
    readonly googleCalendarCache: dynamodb.Table;
  };
  readonly secrets: {
    readonly slackClientSecret: secretsmanager.Secret;
    readonly slackSigningSecret: secretsmanager.Secret;
    readonly googleClientSecret: secretsmanager.Secret;
    readonly travelpayoutsCredentialsSecret: secretsmanager.Secret;
  };
  readonly buckets: {
    readonly marpSlides: s3.Bucket;
    readonly travelItineraries: s3.Bucket;
  };
  readonly travelItineraryPublicBaseUrl: string;
}

/**
 * Data Stack — DynamoDB テーブルと Secrets Manager シークレットのスタック
 */
export class SaborouDataStack extends cdk.Stack {
  public readonly exports: DataStackExports;

  /**
   * コンストラクター
   * @param scope
   * @param id
   * @param props
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext("environment") ?? "dev";
    const isProd = environment === "prod";

    // --- DynamoDB 共通デフォルト ---
    const tableDefaults = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
    };

    // --- テーブル ---
    const users = new dynamodb.Table(this, "UsersTable", {
      ...tableDefaults,
      tableName: `saborou-users-${environment}`,
    });

    const connections = new dynamodb.Table(this, "ConnectionsTable", {
      ...tableDefaults,
      tableName: `saborou-service-connections-${environment}`,
    });

    const taskCandidates = new dynamodb.Table(this, "TaskCandidatesTable", {
      ...tableDefaults,
      tableName: `saborou-task-candidates-${environment}`,
      timeToLiveAttribute: "ttl",
    });

    const tasks = new dynamodb.Table(this, "TasksTable", {
      ...tableDefaults,
      tableName: `saborou-tasks-${environment}`,
    });

    const proposals = new dynamodb.Table(this, "ProposalsTable", {
      ...tableDefaults,
      tableName: `saborou-proposals-${environment}`,
    });

    const honneData = new dynamodb.Table(this, "HonneDataTable", {
      ...tableDefaults,
      tableName: `saborou-honne-data-${environment}`,
    });

    const personas = new dynamodb.Table(this, "PersonasTable", {
      ...tableDefaults,
      tableName: `saborou-personas-${environment}`,
    });

    // Google Calendar キャッシュ（U-07b / BR-G-03）
    // PK=USER#<cognitoSub> SK=CACHE#calendar でユーザーあたり1レコード
    // TTL=24h で古いキャッシュを自動削除
    const googleCalendarCache = new dynamodb.Table(
      this,
      "GoogleCalendarCacheTable",
      {
        ...tableDefaults,
        tableName: `saborou-google-calendar-cache-${environment}`,
        timeToLiveAttribute: "ttl",
      },
    );

    // --- GSI ---
    // connections: Slack identity (<teamId>#<slackUserId>) から所有 Cognito ユーザーを逆引きする。
    // KEYS_ONLY で十分（テーブル PK "USER#<cognitoSub>" が射影されるため cognitoSub を復元できる）。
    connections.addGlobalSecondaryIndex({
      indexName: "GSI-SlackLookup",
      partitionKey: {
        name: "slackLookupKey",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    taskCandidates.addGlobalSecondaryIndex({
      indexName: "GSI-UserCreatedAt",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    tasks.addGlobalSecondaryIndex({
      indexName: "GSI-UserStatus",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "status", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    proposals.addGlobalSecondaryIndex({
      indexName: "GSI-TaskLatest",
      partitionKey: { name: "taskId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "evaluatedAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    honneData.addGlobalSecondaryIndex({
      indexName: "GSI-UserCreatedAt",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- S3: Marp Slides ---
    const marpSlidesBucket = new s3.Bucket(this, "MarpSlidesBucket", {
      bucketName: `saborou-marp-slides-${this.account}-${environment}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: false,
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // --- S3 + CloudFront: Travel Itinerary HTML ---
    const travelItinerariesBucket = new s3.Bucket(
      this,
      "TravelItinerariesBucket",
      {
        bucketName: `saborou-travel-itineraries-${this.account}-${environment}`,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        versioned: false,
        lifecycleRules: [{ expiration: cdk.Duration.days(90) }],
        removalPolicy: isProd
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: !isProd,
      },
    );

    const travelItineraryAccessLogsBucket = new s3.Bucket(
      this,
      "TravelItineraryAccessLogsBucket",
      {
        bucketName: `saborou-travel-itinerary-logs-${this.account}-${environment}`,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
        lifecycleRules: [{ expiration: cdk.Duration.days(90) }],
        removalPolicy: isProd
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: !isProd,
      },
    );

    const itineraryOrigin = origins.S3BucketOrigin.withOriginAccessControl(
      travelItinerariesBucket,
    );
    const itineraryResponseHeaders = new cloudfront.ResponseHeadersPolicy(
      this,
      "TravelItineraryResponseHeadersPolicy",
      {
        responseHeadersPolicyName: `saborou-travel-itinerary-security-${environment}`,
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            override: true,
            contentSecurityPolicy:
              "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          },
          strictTransportSecurity: {
            override: true,
            accessControlMaxAge: cdk.Duration.days(365),
            includeSubdomains: true,
          },
          contentTypeOptions: { override: true },
          frameOptions: {
            override: true,
            frameOption: cloudfront.HeadersFrameOption.DENY,
          },
          referrerPolicy: {
            override: true,
            referrerPolicy:
              cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          },
        },
      },
    );

    const travelItineraryDistribution = new cloudfront.Distribution(
      this,
      "TravelItineraryDistribution",
      {
        defaultBehavior: {
          origin: itineraryOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy: itineraryResponseHeaders,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          compress: true,
        },
        enableLogging: true,
        logBucket: travelItineraryAccessLogsBucket,
        logFilePrefix: "cloudfront/",
        priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
        comment: `Saborou Travel Itinerary Distribution (${environment})`,
      },
    );

    const travelItineraryPublicBaseUrl = `https://${travelItineraryDistribution.distributionDomainName}`;

    // --- Secrets Manager ---
    // 常に固定名を使用。dev では cdk destroy 時に即時削除カスタムリソースが動作する（30日回復期間を回避）
    const slackClientSecret = new secretsmanager.Secret(
      this,
      "SlackClientSecret",
      {
        secretName: `/saborou/slack/client-secret-${environment}`,
        description: "Slack OAuth Client Secret",
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      },
    );

    const slackSigningSecret = new secretsmanager.Secret(
      this,
      "SlackSigningSecret",
      {
        secretName: `/saborou/slack/signing-secret-${environment}`,
        description: "Slack Signing Secret for webhook verification",
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      },
    );

    // Google OAuth client secret（差分5: ForceDelete パターン同一）
    // 命名規則: /saborou/google/client-secret-${environment}（Slackと同一形式）
    const googleClientSecret = new secretsmanager.Secret(
      this,
      "GoogleClientSecret",
      {
        secretName: `/saborou/google/client-secret-${environment}`,
        description: "Google OAuth Client ID and Secret (JSON format)",
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      },
    );

    const travelpayoutsCredentialsSecret = new secretsmanager.Secret(
      this,
      "TravelpayoutsCredentialsSecret",
      {
        secretName: `/saborou/travelpayouts/credentials-${environment}`,
        description: "Travelpayouts credentials JSON: apiToken, marker, trs",
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      },
    );

    // dev: cdk destroy 時に ForceDeleteWithoutRecovery で即時削除するカスタムリソース
    // RETAIN のシークレットは CF が削除しないため、このカスタムリソースが唯一の削除手段
    if (!isProd) {
      const forceDeleteClient = new cr.AwsCustomResource(
        this,
        "ForceDeleteSlackClientSecret",
        {
          onDelete: {
            service: "SecretsManager",
            action: "deleteSecret",
            parameters: {
              SecretId: slackClientSecret.secretArn,
              ForceDeleteWithoutRecovery: true,
            },
            physicalResourceId: cr.PhysicalResourceId.of(
              slackClientSecret.secretArn,
            ),
          },
          policy: cr.AwsCustomResourcePolicy.fromStatements([
            new iam.PolicyStatement({
              actions: ["secretsmanager:DeleteSecret"],
              resources: [slackClientSecret.secretArn],
            }),
          ]),
        },
      );

      const forceDeleteSigning = new cr.AwsCustomResource(
        this,
        "ForceDeleteSlackSigningSecret",
        {
          onDelete: {
            service: "SecretsManager",
            action: "deleteSecret",
            parameters: {
              SecretId: slackSigningSecret.secretArn,
              ForceDeleteWithoutRecovery: true,
            },
            physicalResourceId: cr.PhysicalResourceId.of(
              slackSigningSecret.secretArn,
            ),
          },
          policy: cr.AwsCustomResourcePolicy.fromStatements([
            new iam.PolicyStatement({
              actions: ["secretsmanager:DeleteSecret"],
              resources: [slackSigningSecret.secretArn],
            }),
          ]),
        },
      );

      // Google client secret の ForceDelete（差分5）
      const forceDeleteGoogle = new cr.AwsCustomResource(
        this,
        "ForceDeleteGoogleClientSecret",
        {
          onDelete: {
            service: "SecretsManager",
            action: "deleteSecret",
            parameters: {
              SecretId: googleClientSecret.secretArn,
              ForceDeleteWithoutRecovery: true,
            },
            physicalResourceId: cr.PhysicalResourceId.of(
              googleClientSecret.secretArn,
            ),
          },
          policy: cr.AwsCustomResourcePolicy.fromStatements([
            new iam.PolicyStatement({
              actions: ["secretsmanager:DeleteSecret"],
              resources: [googleClientSecret.secretArn],
            }),
          ]),
        },
      );

      const forceDeleteTravelpayouts = new cr.AwsCustomResource(
        this,
        "ForceDeleteTravelpayoutsCredentialsSecret",
        {
          onDelete: {
            service: "SecretsManager",
            action: "deleteSecret",
            parameters: {
              SecretId: travelpayoutsCredentialsSecret.secretArn,
              ForceDeleteWithoutRecovery: true,
            },
            physicalResourceId: cr.PhysicalResourceId.of(
              travelpayoutsCredentialsSecret.secretArn,
            ),
          },
          policy: cr.AwsCustomResourcePolicy.fromStatements([
            new iam.PolicyStatement({
              actions: ["secretsmanager:DeleteSecret"],
              resources: [travelpayoutsCredentialsSecret.secretArn],
            }),
          ]),
        },
      );
    }

    // --- CfnOutputs ---
    new cdk.CfnOutput(this, "UsersTableName", {
      value: users.tableName,
      description: "DynamoDB Users Table Name",
    });

    new cdk.CfnOutput(this, "TasksTableName", {
      value: tasks.tableName,
      description: "DynamoDB Tasks Table Name",
      exportName: `SaborouTasksTableName-${environment}`,
    });

    new cdk.CfnOutput(this, "ProposalsTableName", {
      value: proposals.tableName,
      description: "DynamoDB Proposals Table Name",
    });

    new cdk.CfnOutput(this, "TravelItinerariesBucketName", {
      value: travelItinerariesBucket.bucketName,
      description: "S3 bucket name for generated travel itinerary HTML",
    });

    new cdk.CfnOutput(this, "TravelItineraryPublicBaseUrl", {
      value: travelItineraryPublicBaseUrl,
      description:
        "CloudFront public base URL for generated travel itinerary HTML",
      exportName: `SaborouTravelItineraryPublicBaseUrl-${environment}`,
    });

    // --- cdk-nag 抑制 ---
    NagSuppressions.addResourceSuppressions(marpSlidesBucket, [
      {
        id: "AwsSolutions-S1",
        reason:
          "Server access logs disabled for hackathon cost scope; slides bucket is internal only",
      },
    ]);

    NagSuppressions.addResourceSuppressions(travelItinerariesBucket, [
      {
        id: "AwsSolutions-S1",
        reason:
          "CloudFront access logs are enabled; S3 server access logs are not required for generated itinerary objects",
      },
    ]);

    NagSuppressions.addResourceSuppressions(travelItineraryAccessLogsBucket, [
      {
        id: "AwsSolutions-S1",
        reason:
          "This bucket stores CloudFront access logs and does not require recursive S3 server access logging",
      },
    ]);

    NagSuppressions.addResourceSuppressions(travelItineraryDistribution, [
      {
        id: "AwsSolutions-CFR4",
        reason:
          "The itinerary distribution intentionally uses the default CloudFront viewer certificate for a hackathon-generated public URL. CloudFront default certificates are reported by cdk-nag as TLSv1 policy even though no custom ACM certificate is configured; a custom domain and ACM certificate can be added later for production TLS policy enforcement.",
      },
    ]);

    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-DDB3",
        reason:
          "PITR is disabled to reduce cost for hackathon scope; data is disposable",
      },
      {
        id: "AwsSolutions-SMG4",
        reason:
          "Secret rotation is disabled for hackathon scope; manually managed external API secrets",
      },
      {
        id: "AwsSolutions-IAM4",
        reason:
          "Custom resource provider Lambda internally requires AWSLambdaBasicExecutionRole; cannot be overridden",
        appliesTo: [
          "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        ],
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Custom resource provider Lambda requires wildcard permissions for internal SDK calls",
        appliesTo: ["Resource::*"],
      },
      {
        id: "AwsSolutions-L1",
        reason:
          "Custom resource provider Lambda runtime is managed by CDK internally and cannot be configured",
      },
    ]);

    this.exports = {
      tables: {
        users,
        connections,
        taskCandidates,
        tasks,
        proposals,
        honneData,
        personas,
        googleCalendarCache,
      },
      secrets: {
        slackClientSecret,
        slackSigningSecret,
        googleClientSecret,
        travelpayoutsCredentialsSecret,
      },
      buckets: {
        marpSlides: marpSlidesBucket,
        travelItineraries: travelItinerariesBucket,
      },
      travelItineraryPublicBaseUrl,
    };
  }
}
