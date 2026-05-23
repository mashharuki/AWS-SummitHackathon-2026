import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { BedrockClientAdapter } from "../bedrock/BedrockClientAdapter.js";
import { DynamoTaskCandidateRepository } from "../repositories/DynamoTaskCandidateRepository.js";
import {
  EventBridgeSlackEventSchema,
  type SlackEventPayload,
} from "../types/events.js";
import { logError, logInfo } from "../utils/logger.js";
import { TaskExtractorAgent } from "./TaskExtractorAgent.js";

/**
 * TaskExtractor の Lambda ハンドラー (U-03a)
 *
 * トリガー: EventBridge カスタムバス (saborou-event-bus-{env})
 *           SlackMessageRule 経由 (detail-type: "SlackMessage")
 *
 * CDK でのハンドラーパス: "task-extractor/TaskExtractorLambdaHandler.handler"
 * (tsup エントリー: "task-extractor/TaskExtractorLambdaHandler")
 *
 * NFR 設計:
 * - DP-03: エントリー時に EventBridge ペイロードの Zod バリデーション
 * - ValidationException はログ記録後に飲み込む (不正イベントは DLQ なし)
 *   理由: 不正イベントのリトライはリソースの無駄; DLQ は一時的な障害用。
 * - ランタイムエラー (Bedrock, DynamoDB) → 伝播 → Lambda リトライ → maxReceiveCount 後に DLQ
 */

// モジュールレベルシングルトン (ウォーム呼び出し間で再利用)
const bedrockClient = new BedrockClientAdapter(
  process.env["BEDROCK_REGION"] ?? "ap-northeast-1",
);
const repository = new DynamoTaskCandidateRepository();

const dynamoDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env["AWS_REGION"] ?? "ap-northeast-1" }),
);

/**
 * Slack user ID から cognitoSub (DynamoDB の userId) を解決する。
 *
 * ServiceConnections テーブルを scan し、slackUserId が一致するレコードの
 * PK から `USER#` プレフィックスを除いた cognitoSub を返す。
 * 見つからない場合は null を返す (不正イベントとしてスキップ)。
 *
 * MVP スコープ: ユーザー数は少ないため scan で対応。
 * 将来的には slackUserId GSI を追加して query に切り替える。
 */
async function resolveUserIdBySlackUserId(
  slackUserId: string,
): Promise<string | null> {
  const tableName = process.env["DYNAMODB_TABLE_CONNECTIONS"];
  if (!tableName) return null;

  try {
    const result = await dynamoDocClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "slackUserId = :slackId",
        ExpressionAttributeValues: { ":slackId": slackUserId },
        ProjectionExpression: "PK",
        Limit: 1,
      }),
    );

    if (!result.Items || result.Items.length === 0) return null;

    const item = result.Items[0] as { PK: string };
    // PK format: USER#<cognitoSub>
    return item.PK.replace(/^USER#/, "");
  } catch (err) {
    logError({
      action: "resolve_user_id_failed",
      slackUserId,
      error: String(err),
    });
    return null;
  }
}

export const handler = async (event: unknown): Promise<void> => {
  // [1] EventBridge エンベロープを検証 (DP-03: 入力側)
  const parsed = EventBridgeSlackEventSchema.safeParse(event);
  if (!parsed.success) {
    logError({
      action: "invalid_input",
      errors: parsed.error.issues,
    });
    // スローせずに返す — 不正イベントは DLQ に送らない
    return;
  }

  const { detail } = parsed.data;
  const rawEvent = detail.event;

  // ボットメッセージ・サブタイプ付きメッセージはスキップ (無限ループ防止)
  if (rawEvent.bot_id || rawEvent.subtype) {
    logInfo({ action: "skipped_bot_or_subtype", subtype: rawEvent.subtype });
    return;
  }

  // ユーザー・テキスト・チャンネルが揃っていない場合はスキップ
  if (!rawEvent.user || !rawEvent.text || !rawEvent.channel) {
    logInfo({ action: "skipped_incomplete_fields" });
    return;
  }

  // Slack user ID (rawEvent.user) を cognitoSub に変換する
  // ServiceConnections テーブルで slackUserId が一致するレコードを検索する
  const slackUserId = rawEvent.user;
  const resolvedUserId = await resolveUserIdBySlackUserId(slackUserId);

  if (!resolvedUserId) {
    logInfo({
      action: "skipped_unmapped_slack_user",
      slackUserId,
      hint: "User may not have connected Slack yet, or authed_user.id was not captured during OAuth",
    });
    return;
  }

  // EventBridge エンベロープ → ドメイン型に変換
  const payload: SlackEventPayload = {
    source: "slack",
    userId: resolvedUserId, // cognitoSub (not Slack user ID)
    message: {
      text: rawEvent.text,
      channelId: rawEvent.channel,
      messageTs: rawEvent.ts,
      teamId: detail.teamId,
      userId: slackUserId, // message.userId はSlack IDのまま（ログ用）
      ...(rawEvent.thread_ts ? { threadTs: rawEvent.thread_ts } : {}),
    },
  };

  // [2] タスクを抽出
  const agent = new TaskExtractorAgent(bedrockClient, repository);
  const result = await agent.extractTask(payload);

  // [3] 結果をログ
  if (result.skipped) {
    logInfo({
      action: "skipped",
      sourceRef: payload.message.messageTs,
    });
  } else {
    logInfo({
      action: "completed",
      candidateId: result.candidate.candidateId,
      sourceRef: payload.message.messageTs,
    });
  }
};
