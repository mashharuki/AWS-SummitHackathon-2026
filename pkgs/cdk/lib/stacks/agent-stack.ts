import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
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

    // --- Bedrock IAM ポリシー (共通) ---
    // us.anthropic.* model IDs use cross-region inference profiles that route through US regions;
    // wildcard region is required so the IAM ARN matches the actual invocation path.
    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      resources: [
        `arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
        `arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0`,
        // U-03b: PersonaRenderer 用 Claude Haiku (Phase 3 トーン変換)
        `arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-3-5-20241022-v1:0`,
        `arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
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
        BEDROCK_REGION: "ap-northeast-1",
        SLACK_TOKEN_SECRET_NAME:
          props.data.secrets.slackClientSecret.secretName,
      },
    });

    taskExtractorFn.addToRolePolicy(bedrockPolicy);
    props.data.tables.taskCandidates.grantReadWriteData(taskExtractorFn);
    props.data.tables.tasks.grantReadData(taskExtractorFn);
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
        // U-03b: ARN ではなく secretName を使用 — ContextCollector が SLACK_TOKEN_SECRET_NAME を参照するため
        SLACK_TOKEN_SECRET_NAME:
          props.data.secrets.slackClientSecret.secretName,
        // DYNAMODB_TABLE_PERSONAS: 削除 (MVP スコープ — U-03b では未使用)
      },
    });

    saboriProposerFn.addToRolePolicy(bedrockPolicy);
    props.data.tables.proposals.grantReadWriteData(saboriProposerFn);
    props.data.tables.tasks.grantReadData(saboriProposerFn);
    // personas テーブルの権限付与を削除 (MVP スコープ)
    props.data.secrets.slackClientSecret.grantRead(saboriProposerFn);

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
