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

// ゴール分解エージェント (PM WBS機能)
export { GoalDecomposerAgent } from "./goal-decomposer/GoalDecomposerAgent.js";
export type { GoalDecomposerInput } from "./goal-decomposer/GoalDecomposerAgent.js";
export type {
  GoalAnalysis,
  SubTask,
  SubTaskStatus,
  SubTaskType,
} from "./goal-decomposer/types.js";
export {
  GoalAnalysisSchema,
  SubTaskSchema,
  SubTaskStatusSchema,
  SubTaskTypeSchema,
} from "./goal-decomposer/types.js";

// 画面スクリーンショット判定エージェント（余白タブ復帰チェック）
export { ScreenAnalysisAgent } from "./screen-analysis/ScreenAnalysisAgent.js";
export type { ScreenAnalysisInput } from "./screen-analysis/ScreenAnalysisAgent.js";
export type { ScreenMatchOutput } from "./screen-analysis/screenAnalysisTool.js";
export {
  SCREEN_MATCH_SYSTEM_PROMPT,
  SCREEN_MATCH_TOOL,
  SCREEN_MATCH_TOOL_NAME,
  ScreenMatchSchema,
} from "./screen-analysis/screenAnalysisTool.js";

// 余白タブ チャット対話エージェント
export { SaborouChatAgent } from "./saborou-chat/SaborouChatAgent.js";
export type {
  SaborouChatInput,
  SaborouChatMessage,
} from "./saborou-chat/SaborouChatAgent.js";
export type { SaborouChatOutput } from "./saborou-chat/saborouChatTool.js";
export {
  SABOROU_CHAT_SYSTEM_PROMPT,
  SABOROU_CHAT_TOOL,
  SABOROU_CHAT_TOOL_NAME,
  SaborouChatSchema,
} from "./saborou-chat/saborouChatTool.js";

// ユーティリティ
export type { SlackEventPayload, SlackMessage } from "./types/events.js";
export { log, logError, logInfo, logWarn } from "./utils/logger.js";
