import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { MonitoringConstruct } from "../constructs/monitoring-construct";
import { AgentStackExports } from "./agent-stack";
import { ApiStackExports } from "./api-stack";
import { DataStackExports } from "./data-stack";

export interface WebhookStackProps extends cdk.StackProps {
  readonly data: DataStackExports;
  readonly api: ApiStackExports;
  readonly agents: AgentStackExports;
}

export interface WebhookStackExports {
  readonly eventBus: events.EventBus;
}

export class SaborouWebhookStack extends cdk.Stack {
  public readonly exports: WebhookStackExports;

  constructor(scope: Construct, id: string, props: WebhookStackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext("environment") ?? "dev";

    // --- EventBridge Custom Bus ---
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

    // --- EventBridge Rule: Slack → TaskExtractor ---
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
        source: ["saborou.webhook"],
        detailType: ["SlackEvent"],
      },
      targets: [
        new eventsTargets.LambdaFunction(props.agents.taskExtractorFn, {
          deadLetterQueue: ruleDlq,
          retryAttempts: 3,
        }),
      ],
    });

    // --- EventBridge Scheduler: hourly background refresh ---
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

    // --- Monitoring (all Lambdas in scope) ---
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

    // --- cdk-nag suppressions ---
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

    this.exports = { eventBus };
  }
}
