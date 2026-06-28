import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { NagSuppressions } from "cdk-nag";
import type { Construct } from "constructs";
import { MonitoringConstruct } from "../constructs/monitoring-construct";
import type { AgentStackExports } from "./agent-stack";
import type { ApiStackExports } from "./api-stack";
import type { DataStackExports } from "./data-stack";

export interface WebhookStackProps extends cdk.StackProps {
  readonly data: DataStackExports;
  readonly api: ApiStackExports;
  readonly agents: AgentStackExports;
}

export interface WebhookStackExports {
  readonly eventBus: events.EventBus;
  readonly webhookUrl: string;
}

/**
 * Webhook Stack — Slack からのイベント受け取りと EventBridge ルーティングのスタック
 */
export class SaborouWebhookStack extends cdk.Stack {
  public readonly exports: WebhookStackExports;

  /**
   * コンストラクター
   * @param scope
   * @param id
   * @param props
   */
  constructor(scope: Construct, id: string, props: WebhookStackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext("environment") ?? "dev";

    // --- EventBridge カスタムバス ---
    const eventBus = new events.EventBus(this, "SaborouEventBus", {
      eventBusName: `saborou-event-bus-${environment}`,
    });

    // --- Webhook Lambda ---
    const webhookLogGroup = new logs.LogGroup(this, "WebhookLogGroup", {
      logGroupName: `/aws/lambda/saborou-webhook-${environment}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const webhookFn = new lambda.Function(this, "WebhookFn", {
      functionName: `saborou-webhook-${environment}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      handler: "webhook.handler",
      code: lambda.Code.fromAsset("../../pkgs/backend/dist"),
      logGroup: webhookLogGroup,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        ENVIRONMENT: environment,
        EVENT_BUS_NAME: eventBus.eventBusName,
        SLACK_SIGNING_SECRET_ARN:
          props.data.secrets.slackSigningSecret.secretArn,
      },
    });

    eventBus.grantPutEventsTo(webhookFn);
    props.data.secrets.slackSigningSecret.grantRead(webhookFn);

    // --- Lambda Function URL (Slack Event API エンドポイント) ---
    // Slack は HTTPS URL に POST するため Lambda Function URL を使用する。
    // HMAC 署名検証はアプリ側で実装済み (NFR-S2) のため IAM 認証は不要。
    const webhookUrl = webhookFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["https://hooks.slack.com"],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: [
          "Content-Type",
          "X-Slack-Signature",
          "X-Slack-Request-Timestamp",
        ],
      },
    });

    NagSuppressions.addResourceSuppressions(webhookFn, [
      {
        id: "AwsSolutions-FAS3",
        reason:
          "Lambda Function URL with NONE auth is intentional; Slack signature verification (HMAC-SHA256) provides equivalent request authentication",
        appliesTo: ["Resource::*"],
      },
    ]);

    // --- EventBridge ルール: Slack → TaskExtractor ---
    const ruleDlq = new sqs.Queue(this, "RuleDlq", {
      queueName: `saborou-rule-dlq-${environment}`,
      retentionPeriod: cdk.Duration.days(1),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    new events.Rule(this, "SlackToTaskExtractorRule", {
      eventBus,
      ruleName: `saborou-slack-to-task-extractor-${environment}`,
      description: "Route Slack events to TaskExtractor Lambda",
      eventPattern: {
        // SlackEvent: Webhook 由来（リアルタイム）／SlackBackfill: 遡及取得 API 由来（C-1）
        source: ["saborou.webhook", "saborou.backend"],
        detailType: ["SlackEvent", "SlackBackfill"],
      },
      targets: [
        new eventsTargets.LambdaFunction(props.agents.taskExtractorFn, {
          deadLetterQueue: ruleDlq,
          retryAttempts: 3,
        }),
      ],
    });

    // --- EventBridge スケジューラー: 1時間ごとのバックグラウンドリフレッシュ ---
    const schedulerRole = new iam.Role(this, "SchedulerRole", {
      roleName: `saborou-scheduler-role-${environment}`,
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });

    props.agents.saboriProposerFn.grantInvoke(schedulerRole);

    new scheduler.CfnSchedule(this, "BackgroundRefreshSchedule", {
      name: `saborou-background-refresh-${environment}`,
      scheduleExpression: "rate(1 hour)",
      flexibleTimeWindow: { mode: "OFF" },
      state: "ENABLED",
      target: {
        arn: props.agents.saboriProposerFn.functionArn,
        roleArn: schedulerRole.roleArn,
        input: JSON.stringify({
          source: "scheduler",
          type: "background_refresh",
        }),
        retryPolicy: {
          maximumRetryAttempts: 3,
        },
      },
    });

    // --- EventBridge スケジューラー: 毎日 17:00 JST の進捗報告 (U-V2-07) ---
    //
    // 設計判断（デモ堅牢性 / MVP）: 進捗報告は「手動トリガー可能な
    // POST /api/tasks/{id}/report」を主軸とし、フル自動の定期送信は副作用が
    // 大きくデモ中の制御が難しい。そのためこのスケジュールは state=DISABLED で
    // 定義のみ行い、将来 ENABLED 化＋専用ハンドラ実装で段階的に有効化する。
    // cron(0 8 * * ? *) = UTC 08:00 = 17:00 JST。target は既存 saboriProposerFn を
    // 流用し、input の type で進捗報告バッチを判別する（ハンドラ実装は将来拡張）。
    new scheduler.CfnSchedule(this, "ProgressReportSchedule", {
      name: `saborou-progress-report-${environment}`,
      scheduleExpression: "cron(0 8 * * ? *)",
      scheduleExpressionTimezone: "UTC",
      flexibleTimeWindow: { mode: "OFF" },
      // MVP: 自動送信はデモ制御性のため無効。手動 endpoint を主軸とする。
      state: "DISABLED",
      target: {
        arn: props.agents.saboriProposerFn.functionArn,
        roleArn: schedulerRole.roleArn,
        input: JSON.stringify({
          source: "scheduler",
          type: "progress_report",
        }),
        retryPolicy: {
          maximumRetryAttempts: 3,
        },
      },
    });

    // --- モニタリング (対象 Lambda 全て) ---
    new MonitoringConstruct(this, "Monitoring", {
      environment,
      honoFn: props.api.honoFn,
      taskExtractorFn: props.agents.taskExtractorFn,
      saboriProposerFn: props.agents.saboriProposerFn,
    });

    // --- CfnOutputs ---
    new cdk.CfnOutput(this, "EventBusName", {
      value: eventBus.eventBusName,
      description: "EventBridge custom bus name",
    });

    new cdk.CfnOutput(this, "WebhookFnArn", {
      value: webhookFn.functionArn,
      description: "Webhook Lambda ARN (Slack events endpoint)",
    });

    new cdk.CfnOutput(this, "WebhookUrl", {
      value: webhookUrl.url,
      description:
        "Lambda Function URL for Slack Event API — set this as the Slack Request URL",
    });

    // --- cdk-nag 抑制 ---
    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-SQS3",
        reason:
          "RuleDlq is a dead-letter queue itself; does not require its own DLQ",
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
          "X-Ray and CloudWatch Logs wildcard; EventBridge PutEvents scoped to specific bus",
      },
      {
        id: "AwsSolutions-L1",
        reason:
          "nodejs22.x is the latest stable Node.js runtime; cdk-nag may not have updated its reference list yet",
      },
    ]);

    this.exports = { eventBus, webhookUrl: webhookUrl.url };
  }
}
