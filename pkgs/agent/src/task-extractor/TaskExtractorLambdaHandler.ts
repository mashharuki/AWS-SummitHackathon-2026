import { BedrockClientAdapter } from "../bedrock/BedrockClientAdapter.js";
import { DynamoSlackUserLookupRepository } from "../repositories/DynamoSlackUserLookupRepository.js";
import { DynamoTaskCandidateRepository } from "../repositories/DynamoTaskCandidateRepository.js";
import {
  EventBridgeSlackBackfillSchema,
  EventBridgeSlackEventSchema,
  type SlackEventPayload,
} from "../types/events.js";
import { logError, logInfo } from "../utils/logger.js";
import { TaskExtractorAgent } from "./TaskExtractorAgent.js";

/**
 * TaskExtractor の Lambda ハンドラー (U-03a / C 拡張)
 *
 * 2 種類の EventBridge イベントを処理する:
 * 1. SlackEvent (source: saborou.webhook) — Slack Webhook 由来。
 *    teamId + Slack user から Cognito ユーザーを逆引きする。
 * 2. SlackBackfill (source: saborou.backend) — 遡及取得 API 由来。
 *    認証ユーザーの cognitoSub を直接持つため逆引き不要。
 *
 * CDK でのハンドラーパス: "task-extractor/TaskExtractorLambdaHandler.handler"
 *
 * NFR 設計:
 * - DP-03: エントリー時に EventBridge ペイロードの Zod バリデーション
 * - ValidationException はログ記録後に飲み込む (不正イベントは DLQ なし)
 * - ランタイムエラー (Bedrock, DynamoDB) → 伝播 → Lambda リトライ → maxReceiveCount 後に DLQ
 */

// モジュールレベルシングルトン (ウォーム呼び出し間で再利用)
const bedrockClient = new BedrockClientAdapter(
  process.env.BEDROCK_REGION ?? "ap-northeast-1",
);
const repository = new DynamoTaskCandidateRepository();
const slackUserLookup = new DynamoSlackUserLookupRepository();

/** Bedrock でタスク抽出を実行し結果をログする共通処理 */
async function runExtraction(payload: SlackEventPayload): Promise<void> {
  const agent = new TaskExtractorAgent(bedrockClient, repository);
  const result = await agent.extractTask(payload);
  if (result.skipped) {
    logInfo({ action: "skipped", sourceRef: payload.message.messageTs });
  } else {
    logInfo({
      action: "completed",
      candidateId: result.candidate.candidateId,
      sourceRef: payload.message.messageTs,
    });
  }
}

export const handler = async (event: unknown): Promise<void> => {
  // backfill (遡及取得 API 由来) を先に判定 — cognitoSub を直接持つ
  const backfill = EventBridgeSlackBackfillSchema.safeParse(event);
  if (backfill.success) {
    await handleBackfill(backfill.data);
    return;
  }

  // Slack Webhook 由来イベント
  const parsed = EventBridgeSlackEventSchema.safeParse(event);
  if (!parsed.success) {
    logError({ action: "invalid_input", errors: parsed.error.issues });
    // スローせずに返す — 不正イベントは DLQ に送らない
    return;
  }
  await handleSlackEvent(parsed.data);
};

/** SlackBackfill: cognitoSub を直接使う（逆引き不要） */
async function handleBackfill(
  data: import("../types/events.js").EventBridgeSlackBackfill,
): Promise<void> {
  const { userId, message } = data.detail;

  const payload: SlackEventPayload = {
    source: "slack",
    userId,
    message: {
      text: message.text,
      channelId: message.channel,
      messageTs: message.ts,
      teamId: message.team,
      userId: message.user,
      ...(message.thread_ts ? { threadTs: message.thread_ts } : {}),
    },
  };
  await runExtraction(payload);
}

/** SlackEvent: teamId + Slack user から Cognito ユーザーを逆引きする */
async function handleSlackEvent(
  data: import("../types/events.js").EventBridgeSlackEvent,
): Promise<void> {
  const { detail } = data;
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
  // GSI-SlackLookup を使って teamId + slackUserId → cognitoSub を解決する
  const slackUserId = rawEvent.user;
  const resolvedUserId = await slackUserLookup.findCognitoSubBySlackIdentity(
    detail.teamId,
    slackUserId,
  );

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
  await runExtraction(payload);
}
