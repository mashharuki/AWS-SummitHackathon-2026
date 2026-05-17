/**
 * @saboru/agent — Public API surface
 *
 * Lambda entry points are defined separately in tsup.config.ts:
 * - "task-extractor/TaskExtractorLambdaHandler" → dist/task-extractor/TaskExtractorLambdaHandler.*
 * - "sabori-proposer/SaboriProposerLambdaHandler" → dist/sabori-proposer/SaboriProposerLambdaHandler.*
 *
 * This index exports classes/interfaces for potential reuse by other packages.
 */

// Bedrock
export type { IBedrockClient } from "./bedrock/IBedrockClient.js";
export { BedrockClientAdapter } from "./bedrock/BedrockClientAdapter.js";

// Task Extractor (U-03a)
export { TaskExtractorAgent } from "./task-extractor/TaskExtractorAgent.js";
export type { ExtractionResult } from "./task-extractor/TaskExtractorAgent.js";
export { DynamoTaskCandidateRepository } from "./repositories/DynamoTaskCandidateRepository.js";

// Sabori Proposer (U-03b)
export { SaboriProposerAgent } from "./sabori-proposer/SaboriProposerAgent.js";
export { PersonaRenderer } from "./sabori-proposer/PersonaRenderer.js";
export { DynamoProposalRepository } from "./repositories/DynamoProposalRepository.js";
export type {
  TaskContext,
  SlackContext,
  LLMJudgment,
  ContextSignals,
  ProposalDelta,
  RenderInput,
  RenderOutput,
} from "./sabori-proposer/types.js";

// Context Collector (shared)
export { ContextCollector } from "./context-collector/ContextCollector.js";

// Utilities
export { log, logInfo, logWarn, logError } from "./utils/logger.js";
export type { SlackEventPayload, SlackMessage } from "./types/events.js";
