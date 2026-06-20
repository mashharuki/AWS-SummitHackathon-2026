/**
 * @saboru/agent — パブリック API
 *
 * Lambda エントリーポイントは tsup.config.ts で別途定義:
 * - "task-extractor/TaskExtractorLambdaHandler" → dist/task-extractor/TaskExtractorLambdaHandler.*
 * - "sabori-proposer/SaboriProposerLambdaHandler" → dist/sabori-proposer/SaboriProposerLambdaHandler.*
 *
 * このインデックスは他のパッケージで再利用できるようクラス/インターフェースをエクスポートする。
 */

// Bedrock
export { BedrockClientAdapter } from "./bedrock/BedrockClientAdapter.js";
export type { IBedrockClient } from "./bedrock/IBedrockClient.js";

// タスク抽出エージェント (U-03a)
export { DynamoTaskCandidateRepository } from "./repositories/DynamoTaskCandidateRepository.js";
export { TaskExtractorAgent } from "./task-extractor/TaskExtractorAgent.js";
export type {
  ExtractionResult,
  GenericExtractInput,
} from "./task-extractor/TaskExtractorAgent.js";

// サボリ提案エージェント (U-03b)
export { DynamoProposalRepository } from "./repositories/DynamoProposalRepository.js";
export { PersonaRenderer } from "./sabori-proposer/PersonaRenderer.js";
export { SaboriProposerAgent } from "./sabori-proposer/SaboriProposerAgent.js";
export type {
  CalendarContext,
  ContextSignals,
  LLMJudgment,
  ProposalDelta,
  RenderInput,
  RenderOutput,
  SlackContext,
  TaskContext,
} from "./sabori-proposer/types.js";

// サボリ提案エージェント v2 — 返信文 / 断り文生成 (U-V2-05)
export { SaboriProposerAgentV2 } from "./sabori-proposer/SaboriProposerAgentV2.js";
export type {
  DeclineDraftInput,
  ReplyDraftInput,
} from "./sabori-proposer/SaboriProposerAgentV2.js";
export {
  REPLY_DRAFT_SYSTEM_PROMPT,
  REPLY_DRAFT_TOOL,
  REPLY_DRAFT_TOOL_NAME,
  ReplyDraftSchema,
} from "./sabori-proposer/replyDraftTool.js";
export type { ReplyDraft } from "./sabori-proposer/replyDraftTool.js";
export {
  DECLINE_DRAFT_SYSTEM_PROMPT,
  DECLINE_DRAFT_TOOL,
  DECLINE_DRAFT_TOOL_NAME,
  DeclineDraftSchema,
} from "./sabori-proposer/declineDraftTool.js";
export type { DeclineDraft } from "./sabori-proposer/declineDraftTool.js";

// 段取り逆算エージェント (U-G03: schedule-planner)
export { SchedulePlannerAgent } from "./schedule-planner/SchedulePlannerAgent.js";
export type {
  SchedulePlannerInput,
  StepDraftInput,
} from "./schedule-planner/SchedulePlannerAgent.js";
export {
  calcSchedule,
  resolveWindowEnd,
  normalizeBusySlots,
  buildAvailableSlots,
} from "./schedule-planner/saboruBlockCalc.js";
export {
  PLAN_SCHEDULE_TOOL,
  PLAN_SCHEDULE_TOOL_NAME,
  PlanScheduleOutputSchema,
  ScheduleStepSchema,
} from "./schedule-planner/tools.js";
export type {
  PlanScheduleOutput,
  ScheduleStep,
} from "./schedule-planner/tools.js";

// コンテキストコレクター (共有)
export {
  ContextCollector,
  getSlackToken,
  getSlackUserToken,
  resetSlackTokenCache,
} from "./context-collector/ContextCollector.js";

// Slack Web API クライアント
export {
  SlackApiError,
  type SlackChannel,
  SlackClient,
  type SlackHistoryMessage,
} from "./slack-client/SlackClient.js";

// ユーティリティ
export type { SlackEventPayload, SlackMessage } from "./types/events.js";
export { log, logError, logInfo, logWarn } from "./utils/logger.js";
