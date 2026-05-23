import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

/**
 * Slack identity → Cognito user (cognitoSub) の逆引き専用リポジトリ。
 *
 * テーブル: service-connections
 *   GSI-SlackLookup: PK=slackLookupKey ("<teamId>#<slackUserId>"), KEYS_ONLY
 *   ヒットしたテーブル PK "USER#<cognitoSub>" から cognitoSub を復元する。
 *
 * 連携が解除/未設定なら null を返す（呼び出し元で安全にスキップ）。
 */
export class DynamoSlackUserLookupRepository {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly connectionsTable: string;

  constructor() {
    const ddbClient = new DynamoDBClient({
      region: process.env.AWS_REGION ?? "ap-northeast-1",
    });
    this.docClient = DynamoDBDocumentClient.from(ddbClient);
    this.connectionsTable =
      process.env.DYNAMODB_TABLE_CONNECTIONS ??
      "saborou-service-connections-dev";
  }

  /** Slack identity を GSI-SlackLookup の合成パーティションキーに変換する */
  private buildLookupKey(slackTeamId: string, slackUserId: string): string {
    return `${slackTeamId}#${slackUserId}`;
  }

  /**
   * Slack identity から所有 Cognito ユーザー (cognitoSub) を逆引きする。
   *
   * @returns cognitoSub。連携済みユーザーが見つからなければ null。
   */
  async findCognitoSubBySlackIdentity(
    slackTeamId: string,
    slackUserId: string,
  ): Promise<string | null> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.connectionsTable,
        IndexName: "GSI-SlackLookup",
        KeyConditionExpression: "slackLookupKey = :k",
        ExpressionAttributeValues: {
          ":k": this.buildLookupKey(slackTeamId, slackUserId),
        },
        Limit: 1,
      }),
    );

    const item = result.Items?.[0];
    if (!item) return null;
    const pk = item.PK as string | undefined;
    // PK 形式: "USER#<cognitoSub>"
    return pk?.startsWith("USER#") ? pk.slice("USER#".length) : null;
  }
}
