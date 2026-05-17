import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface MonitoringConstructProps {
  readonly environment: string;
  readonly honoFn: lambda.Function;
  readonly taskExtractorFn: lambda.Function;
  readonly saboriProposerFn: lambda.Function;
}

/**
 * MonitoringConstruct: CloudWatch alarms and dashboard for Saborou application.
 * Integrates into SaborouApiStack (no separate stack to keep infra simple).
 */
export class MonitoringConstruct extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringConstructProps) {
    super(scope, id);

    // --- API Lambda Error Alarm ---
    const apiErrorAlarm = new cloudwatch.Alarm(this, "ApiErrorAlarm", {
      alarmName: `saborou-api-errors-${props.environment}`,
      alarmDescription: "API Lambda error rate exceeds threshold",
      metric: props.honoFn.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: "Sum",
      }),
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // --- API Lambda Throttle Alarm ---
    const apiThrottleAlarm = new cloudwatch.Alarm(this, "ApiThrottleAlarm", {
      alarmName: `saborou-api-throttles-${props.environment}`,
      alarmDescription: "API Lambda throttle rate exceeds threshold",
      metric: props.honoFn.metricThrottles({
        period: cdk.Duration.minutes(5),
        statistic: "Sum",
      }),
      threshold: 5,
      evaluationPeriods: 2,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // --- TaskExtractor Error Alarm ---
    const taskExtractorErrorAlarm = new cloudwatch.Alarm(
      this,
      "TaskExtractorErrorAlarm",
      {
        alarmName: `saborou-task-extractor-errors-${props.environment}`,
        alarmDescription: "TaskExtractor Lambda error rate exceeds threshold",
        metric: props.taskExtractorFn.metricErrors({
          period: cdk.Duration.minutes(10),
          statistic: "Sum",
        }),
        threshold: 5,
        evaluationPeriods: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      },
    );

    // --- SaboriProposer Error Alarm ---
    const saboriProposerErrorAlarm = new cloudwatch.Alarm(
      this,
      "SaboriProposerErrorAlarm",
      {
        alarmName: `saborou-sabori-proposer-errors-${props.environment}`,
        alarmDescription: "SaboriProposer Lambda error rate exceeds threshold",
        metric: props.saboriProposerFn.metricErrors({
          period: cdk.Duration.minutes(10),
          statistic: "Sum",
        }),
        threshold: 5,
        evaluationPeriods: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      },
    );

    // --- API Latency Alarm ---
    const apiLatencyAlarm = new cloudwatch.Alarm(this, "ApiLatencyAlarm", {
      alarmName: `saborou-api-latency-${props.environment}`,
      alarmDescription: "API Lambda P99 latency exceeds 10 seconds",
      metric: props.honoFn.metricDuration({
        period: cdk.Duration.minutes(5),
        statistic: "p99",
      }),
      threshold: 10000,
      evaluationPeriods: 3,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // --- CloudWatch Dashboard ---
    this.dashboard = new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: `saborou-dashboard-${props.environment}`,
    });

    this.dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        title: "Alarm Status",
        alarms: [
          apiErrorAlarm,
          apiThrottleAlarm,
          taskExtractorErrorAlarm,
          saboriProposerErrorAlarm,
          apiLatencyAlarm,
        ],
        width: 24,
        height: 3,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "API Lambda - Invocations & Errors",
        left: [
          props.honoFn.metricInvocations({ period: cdk.Duration.minutes(5) }),
          props.honoFn.metricErrors({ period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: "API Lambda - Duration (p50/p95/p99)",
        left: [
          props.honoFn.metricDuration({
            period: cdk.Duration.minutes(5),
            statistic: "p50",
            label: "p50",
          }),
          props.honoFn.metricDuration({
            period: cdk.Duration.minutes(5),
            statistic: "p95",
            label: "p95",
          }),
          props.honoFn.metricDuration({
            period: cdk.Duration.minutes(5),
            statistic: "p99",
            label: "p99",
          }),
        ],
        width: 12,
        height: 6,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Agent Lambdas - Invocations & Errors",
        left: [
          props.taskExtractorFn.metricInvocations({
            period: cdk.Duration.minutes(10),
          }),
          props.taskExtractorFn.metricErrors({
            period: cdk.Duration.minutes(10),
          }),
          props.saboriProposerFn.metricInvocations({
            period: cdk.Duration.minutes(10),
          }),
          props.saboriProposerFn.metricErrors({
            period: cdk.Duration.minutes(10),
          }),
        ],
        width: 24,
        height: 6,
      }),
    );
  }
}
