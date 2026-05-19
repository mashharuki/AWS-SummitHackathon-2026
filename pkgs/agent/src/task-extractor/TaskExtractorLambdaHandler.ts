import { BedrockClientAdapter } from "../bedrock/BedrockClientAdapter.js";
import { DynamoTaskCandidateRepository } from "../repositories/DynamoTaskCandidateRepository.js";
import { SlackEventPayloadSchema } from "../types/events.js";
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

export const handler = async (event: unknown): Promise<void> => {
  // [1] EventBridge ペイロードを検証 (DP-03: 入力側)
  const parsed = SlackEventPayloadSchema.safeParse(event);
  if (!parsed.success) {
    logError({
      action: "invalid_input",
      errors: parsed.error.issues,
    });
    // スローせずに返す — 不正イベントは DLQ に送らない
    return;
  }

  const payload = parsed.data;

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
