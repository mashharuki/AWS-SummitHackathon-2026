import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
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
  };
  readonly secrets: {
    readonly slackClientSecret: secretsmanager.Secret;
    readonly slackSigningSecret: secretsmanager.Secret;
  };
}

export class SaborouDataStack extends cdk.Stack {
  public readonly exports: DataStackExports;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext("environment") ?? "dev";

    // --- DynamoDB 共通デフォルト ---
    const tableDefaults = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
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

    // --- GSI ---
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

    // --- Secrets Manager ---
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

    // --- cdk-nag 抑制 ---
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
      },
      secrets: { slackClientSecret, slackSigningSecret },
    };
  }
}
