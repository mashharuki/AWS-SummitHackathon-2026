import { BedrockClientAdapter } from "../bedrock/BedrockClientAdapter.js";
import { DynamoTaskCandidateRepository } from "../repositories/DynamoTaskCandidateRepository.js";
import { SlackEventPayloadSchema } from "../types/events.js";
import { logError, logInfo } from "../utils/logger.js";
import { TaskExtractorAgent } from "./TaskExtractorAgent.js";

/**
 * Lambda handler for TaskExtractor (U-03a)
 *
 * Trigger: EventBridge custom bus (saborou-event-bus-{env})
 *          via SlackMessageRule (detail-type: "SlackMessage")
 *
 * Handler path in CDK: "task-extractor/TaskExtractorLambdaHandler.handler"
 * (tsup entry: "task-extractor/TaskExtractorLambdaHandler")
 *
 * NFR Design:
 * - DP-03: Zod validation of EventBridge payload on entry
 * - ValidationException is logged and swallowed (no DLQ for malformed events)
 *   Rationale: Retrying a malformed event wastes resources; DLQ is for transient failures.
 * - Runtime errors (Bedrock, DynamoDB) propagate → Lambda retries → DLQ after maxReceiveCount
 */

// Module-level singletons (reused across warm invocations)
const bedrockClient = new BedrockClientAdapter(
  process.env["BEDROCK_REGION"] ?? "ap-northeast-1",
);
const repository = new DynamoTaskCandidateRepository();

export const handler = async (event: unknown): Promise<void> => {
  // [1] Validate EventBridge payload (DP-03: input-side)
  const parsed = SlackEventPayloadSchema.safeParse(event);
  if (!parsed.success) {
    logError({
      action: "invalid_input",
      errors: parsed.error.issues,
    });
    // Return without throwing — malformed events should NOT go to DLQ
    return;
  }

  const payload = parsed.data;

  // [2] Extract task
  const agent = new TaskExtractorAgent(bedrockClient, repository);
  const result = await agent.extractTask(payload);

  // [3] Log outcome
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
