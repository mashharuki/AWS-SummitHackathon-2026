import { BedrockClientAdapter } from "../bedrock/BedrockClientAdapter.js";
import { DynamoSlackUserLookupRepository } from "../repositories/DynamoSlackUserLookupRepository.js";
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
  process.env.BEDROCK_REGION ?? "ap-northeast-1",
);
const repository = new DynamoTaskCandidateRepository();
const slackUserLookup = new DynamoSlackUserLookupRepository();

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

  // Slack identity (teamId + Slack user) から所有 Cognito ユーザーを逆引きする。
  // 連携していない Slack ユーザーのメッセージはスキップ（こちらの管理対象外）。
  const cognitoSub = await slackUserLookup.findCognitoSubBySlackIdentity(
    detail.teamId,
    rawEvent.user,
  );
  if (!cognitoSub) {
    logInfo({
      action: "skipped_unlinked_slack_user",
      teamId: detail.teamId,
    });
    return;
  }

  // EventBridge エンベロープ → ドメイン型に変換
  // userId は Cognito sub（逆引き結果）。message.userId は Slack user ID
  // （TaskExtractorAgent が依頼者の仮名化に使用）。
  const payload: SlackEventPayload = {
    source: "slack",
    userId: cognitoSub,
    message: {
      text: rawEvent.text,
      channelId: rawEvent.channel,
      messageTs: rawEvent.ts,
      teamId: detail.teamId,
      userId: rawEvent.user,
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
