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
export type { ExtractionResult } from "./task-extractor/TaskExtractorAgent.js";

// サボリ提案エージェント (U-03b)
export { DynamoProposalRepository } from "./repositories/DynamoProposalRepository.js";
export { PersonaRenderer } from "./sabori-proposer/PersonaRenderer.js";
export { SaboriProposerAgent } from "./sabori-proposer/SaboriProposerAgent.js";
export type {
  ContextSignals,
  LLMJudgment,
  ProposalDelta,
  RenderInput,
  RenderOutput,
  SlackContext,
  TaskContext,
} from "./sabori-proposer/types.js";

// コンテキストコレクター (共有)
export { ContextCollector } from "./context-collector/ContextCollector.js";

// ユーティリティ
export type { SlackEventPayload, SlackMessage } from "./types/events.js";
export { log, logError, logInfo, logWarn } from "./utils/logger.js";
