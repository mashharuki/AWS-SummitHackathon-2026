import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { NagSuppressions } from "cdk-nag";
import type { Construct } from "constructs";
import type { DataStackExports } from "./data-stack";

export interface AgentStackProps extends cdk.StackProps {
  readonly data: DataStackExports;
}

export interface AgentStackExports {
  readonly taskExtractorFn: lambda.Function;
  readonly saboriProposerFn: lambda.Function;
}

/**
 * SaborouAgentStack: タスク抽出とサボり提案の Lambda をホストするスタック。
 * これらは両方とも Bedrock を呼び出すため、同一スタックにまとめて共通 IAM ポリシーを適用する。
 * また、MVP スコープではモニタリング要件がないため、CloudWatch アラームやダッシュボードは実装しない。
 * 将来的には MonitoringConstruct を追加して SaborouApiStack に組み込む予定 (AG-06)。
 */
export class SaborouAgentStack extends cdk.Stack {
  /** エクスポートされる Lambda 関数 */
  public readonly exports: AgentStackExports;

  /**
   * コンストラクター
   * @param scope
   * @param id
   * @param props
   */
  constructor(scope: Construct, id: string, props: AgentStackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext("environment") ?? "dev";

    // --- 仮名化ソルト (SSM Parameter Store から取得) ---
    const pseudonymizeSalt = ssm.StringParameter.valueForStringParameter(
      this,
      `/saborou/pseudonymize-salt-${environment}`,
    );

    // --- Bedrock IAM ポリシー (共通) ---
    // ap. プレフィックスの AP クロスリージョン推論プロファイルを使用するため、
    // 推論プロファイル ARN (呼び出しリージョン固定) とベースモデル ARN (ワイルドカードリージョン) の両方が必要。
    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      resources: [
        // 推論プロファイル ARN (呼び出しリージョン: ap-northeast-1 固定)
        `arn:aws:bedrock:ap-northeast-1:${this.account}:inference-profile/jp.anthropic.claude-sonnet-4-6`,
        `arn:aws:bedrock:ap-northeast-1:${this.account}:inference-profile/ap.anthropic.claude-sonnet-4-6`,
        // ベースモデル ARN — クロスリージョン推論がルーティングする全リージョンを許可
        // jp. プロファイル: ap-northeast-1 (Tokyo) / ap-northeast-3 (Osaka)
        // ap. プロファイル: AP リージョン全般 → ワイルドカードで対応
        "arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-sonnet-4-6",
        "arn:aws:bedrock:ap-northeast-3::foundation-model/anthropic.claude-sonnet-4-6",
        "arn:aws:bedrock:ap-southeast-1::foundation-model/anthropic.claude-sonnet-4-6",
        "arn:aws:bedrock:ap-southeast-2::foundation-model/anthropic.claude-sonnet-4-6",
        // Claude Haiku 4.5 (PersonaRenderer 口調変換): JP Geo 推論プロファイル
        // ※ Haiku 3.5 は ap-northeast-1 に存在しないため 4.5 を使用
        `arn:aws:bedrock:ap-northeast-1:${this.account}:inference-profile/jp.anthropic.claude-haiku-4-5-20251001-v1:0`,
        "arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
        "arn:aws:bedrock:ap-northeast-3::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
      ],
    });

    // --- TaskExtractor DLQ ---
    const taskExtractorDlq = new sqs.Queue(this, "TaskExtractorDlq", {
      queueName: `saborou-task-extractor-dlq-${environment}`,
      retentionPeriod: cdk.Duration.days(1),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // --- TaskExtractor Lambda ---
    const taskExtractorLogGroup = new logs.LogGroup(
      this,
      "TaskExtractorLogGroup",
      {
        logGroupName: `/aws/lambda/saborou-task-extractor-${environment}`,
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      },
    );

    // U-03a: タスク抽出は応答が比較的早い想定のため、Lambda タイムアウトは 60 秒に設定
    const taskExtractorFn = new lambda.Function(this, "TaskExtractorFn", {
      functionName: `saborou-task-extractor-${environment}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      handler: "task-extractor/TaskExtractorLambdaHandler.handler",
      code: lambda.Code.fromAsset("../../pkgs/agent/dist"),
      logGroup: taskExtractorLogGroup,
      tracing: lambda.Tracing.ACTIVE,
      deadLetterQueue: taskExtractorDlq,
      environment: {
        ENVIRONMENT: environment,
        DYNAMODB_TABLE_TASK_CANDIDATES:
          props.data.tables.taskCandidates.tableName,
        DYNAMODB_TABLE_TASKS: props.data.tables.tasks.tableName,
        // Slack user ID → cognitoSub マッピング解決に使用（Slack/Cognito IDミスマッチ修正）
        DYNAMODB_TABLE_CONNECTIONS: props.data.tables.connections.tableName,
        BEDROCK_REGION: "ap-northeast-1",
        // per-user の Slack Bot Token シークレット名プレフィックス。
        // ContextCollector が `${prefix}${cognitoSub}` で個別トークンを取得する。
        SLACK_BOT_TOKEN_SECRET_PREFIX: `saborou/slack-bot-token/`,
        PSEUDONYMIZE_SALT: pseudonymizeSalt,
      },
    });

    // --- per-user Slack Bot Token への読み取り権限（OAuth で saborou/slack-bot-token/<sub> に保存される） ---
    const slackBotTokenReadPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["secretsmanager:GetSecretValue"],
      resources: [
        `arn:aws:secretsmanager:${this.region}:${this.account}:secret:saborou/slack-bot-token/*`,
      ],
    });

    // --- AWS Marketplace 権限 (Bedrock モデルアクセス確認に必要) ---
    const marketplacePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "aws-marketplace:ViewSubscriptions",
        "aws-marketplace:Subscribe",
        "aws-marketplace:Unsubscribe",
      ],
      resources: ["*"],
    });

    taskExtractorFn.addToRolePolicy(bedrockPolicy);
    taskExtractorFn.addToRolePolicy(marketplacePolicy);
    taskExtractorFn.addToRolePolicy(slackBotTokenReadPolicy);
    props.data.tables.taskCandidates.grantReadWriteData(taskExtractorFn);
    props.data.tables.tasks.grantReadData(taskExtractorFn);
    // 接続テーブル読み取り権限（Slack user ID → cognitoSub マッピング解決用）
    props.data.tables.connections.grantReadData(taskExtractorFn);
    props.data.secrets.slackClientSecret.grantRead(taskExtractorFn);
    
    // --- SaboriProposer DLQ ---
    const saboriProposerDlq = new sqs.Queue(this, "SaboriProposerDlq", {
      queueName: `saborou-sabori-proposer-dlq-${environment}`,
      retentionPeriod: cdk.Duration.days(1),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // --- SaboriProposer Lambda ---
    const saboriProposerLogGroup = new logs.LogGroup(
      this,
      "SaboriProposerLogGroup",
      {
        logGroupName: `/aws/lambda/saborou-sabori-proposer-${environment}`,
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      },
    );

    const saboriProposerFn = new lambda.Function(this, "SaboriProposerFn", {
      functionName: `saborou-sabori-proposer-${environment}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      // U-03b: SSE ストリーミングバッファのため 1024 MB; Phase 2 (Sonnet) + Phase 3 (Haiku) のため 90 秒
      memorySize: 1024,
      timeout: cdk.Duration.seconds(90),
      handler: "sabori-proposer/SaboriProposerLambdaHandler.handler",
      code: lambda.Code.fromAsset("../../pkgs/agent/dist"),
      logGroup: saboriProposerLogGroup,
      tracing: lambda.Tracing.ACTIVE,
      deadLetterQueue: saboriProposerDlq,
      environment: {
        ENVIRONMENT: environment,
        DYNAMODB_TABLE_PROPOSALS: props.data.tables.proposals.tableName,
        DYNAMODB_TABLE_TASKS: props.data.tables.tasks.tableName,
        BEDROCK_REGION: "ap-northeast-1",
        // per-user の Slack Bot Token シークレット名プレフィックス（ContextCollector が参照）
        SLACK_BOT_TOKEN_SECRET_PREFIX: `saborou/slack-bot-token/`,
        // DYNAMODB_TABLE_PERSONAS: 削除 (MVP スコープ — U-03b では未使用)
        PSEUDONYMIZE_SALT: pseudonymizeSalt,
      },
    });

    saboriProposerFn.addToRolePolicy(bedrockPolicy);
    saboriProposerFn.addToRolePolicy(marketplacePolicy);
    saboriProposerFn.addToRolePolicy(slackBotTokenReadPolicy);
    props.data.tables.proposals.grantReadWriteData(saboriProposerFn);
    props.data.tables.tasks.grantReadData(saboriProposerFn);
    // personas テーブルの権限付与を削除 (MVP スコープ)
    // Slack Bot Token は per-user シークレットのため slackBotTokenReadPolicy で付与済み
    // （旧: slackClientSecret.grantRead は OAuth Client Secret 用で Bot Token とは無関係だったため削除）

    // --- CfnOutputs ---
    new cdk.CfnOutput(this, "TaskExtractorFnArn", {
      value: taskExtractorFn.functionArn,
      description: "Task Extractor Lambda ARN",
    });

    new cdk.CfnOutput(this, "SaboriProposerFnArn", {
      value: saboriProposerFn.functionArn,
      description: "Sabori Proposer Lambda ARN",
    });

    // --- cdk-nag 抑制 ---
    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-SQS3",
        reason:
          "DLQ queues themselves do not need a DLQ; they are the final destination for failed messages",
      },
      {
        id: "AwsSolutions-SQS4",
        reason:
          "SSL enforcement on DLQ queues is not required for hackathon scope; DLQs are internal-only targets",
      },
      {
        id: "AwsSolutions-IAM4",
        reason:
          "AWSLambdaBasicExecutionRole is minimum required managed policy for Lambda execution",
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "X-Ray and CloudWatch Logs require wildcard; Bedrock resources are scoped to specific model ARNs",
      },
      {
        id: "AwsSolutions-L1",
        reason:
          "nodejs22.x is the latest stable Node.js runtime; cdk-nag may not have updated its reference list yet",
      },
    ]);

    this.exports = { taskExtractorFn, saboriProposerFn };
  }
}
