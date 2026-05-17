import type { ITaskCandidateRepository, TaskCandidate } from "@saboru/shared";
import {
  SOURCE_TYPE,
  TASK_CANDIDATE_STATUS,
  TASK_CANDIDATE_TTL_DAYS,
  generateUlid,
  pseudonymize,
  toIsoString,
  DDB_PREFIX,
} from "@saboru/shared";
import type { IBedrockClient } from "../bedrock/IBedrockClient.js";
import { createTaskCandidateWithUserId } from "../repositories/DynamoTaskCandidateRepository.js";
import { logError, logInfo } from "../utils/logger.js";
import type { SlackEventPayload } from "../types/events.js";
import {
  EXTRACT_TASK_TOOL,
  EXTRACT_TASK_TOOL_NAME,
  ExtractedTaskSchema,
} from "./extractTaskTool.js";

/**
 * Model ID for cross-region inference (ap-northeast-1 → us-east-1 fallback)
 * The IAM resource ARN uses the base model ID without the "us." prefix.
 * Infrastructure Design sec.4 documents this AWS-specific behavior.
 */
const MODEL_ID = "us.anthropic.claude-3-5-sonnet-20241022-v2:0";

/** Result type for task extraction */
export type ExtractionResult =
  | { skipped: true }
  | { skipped: false; candidate: TaskCandidate };

/**
 * TaskExtractorAgent — Core agent for U-03a
 *
 * Responsibilities:
 * 1. Validate EventBridge payload (done in LambdaHandler before calling this)
 * 2. Call Bedrock converse API with toolChoice.tool forced (DP-02)
 * 3. Validate Bedrock output with Zod (DP-03)
 * 4. Discard raw message text; store only sourceRef (DP-04)
 * 5. Pseudonymize requester name (BR-05)
 * 6. Persist TaskCandidate via repository (DP-05 idempotency handled in repo)
 */
export class TaskExtractorAgent {
  constructor(
    private readonly bedrock: IBedrockClient,
    private readonly repository: ITaskCandidateRepository,
  ) {}

  async extractTask(event: SlackEventPayload): Promise<ExtractionResult> {
    const { text, messageTs, userId: slackUserId } = event.message;
    const { userId } = event;

    const startMs = Date.now();

    // [1] Call Bedrock with toolChoice.tool forced (DP-02)
    const response = await this.bedrock.converse({
      modelId: MODEL_ID,
      messages: [
        {
          role: "user",
          content: [
            {
              text:
                "Please analyze the following Slack message and extract task information:\n\n" +
                `Message: ${text}\n\n` +
                `Sent by Slack user: ${slackUserId}`,
            },
          ],
        },
      ],
      toolConfig: {
        tools: [EXTRACT_TASK_TOOL],
        toolChoice: {
          tool: { name: EXTRACT_TASK_TOOL_NAME },
        },
      },
      inferenceConfig: {
        maxTokens: 512, // DP-08: fixed to minimize cost
        temperature: 0, // deterministic output
      },
    });

    const bedrockDurationMs = Date.now() - startMs;

    // [2] Extract tool use block from response
    const toolUseBlock = response.output?.message?.content?.find(
      (block) => block.toolUse?.name === EXTRACT_TASK_TOOL_NAME,
    );

    if (!toolUseBlock?.toolUse?.input) {
      logError({
        action: "bedrock_no_tool_use",
        stopReason: response.stopReason,
        bedrockDurationMs,
      });
      throw new Error(
        `Bedrock did not return tool use block (stopReason: ${response.stopReason})`,
      );
    }

    // [3] Zod validation of Bedrock output (DP-03: output-side)
    const parseResult = ExtractedTaskSchema.safeParse(
      toolUseBlock.toolUse.input,
    );
    if (!parseResult.success) {
      logError({
        action: "bedrock_output_invalid",
        issues: parseResult.error.issues,
      });
      throw new Error("Bedrock tool output failed schema validation");
    }

    const extracted = parseResult.data;

    // [4] Skip if not a task
    if (!extracted.is_task) {
      logInfo({
        action: "skipped_not_task",
        sourceRef: messageTs,
        bedrockDurationMs,
      });
      return { skipped: true };
    }

    // [5] Build and persist TaskCandidate (DP-04: raw text discarded after this point)
    const now = new Date();
    const candidateId = generateUlid();

    const candidate = await createTaskCandidateWithUserId(
      this.repository,
      userId,
      {
        candidateId,
        title: extracted.title,
        deadline: extracted.deadline,
        requester: pseudonymize(extracted.requester), // BR-05: pseudonymize
        description: extracted.description,
        sourceType: SOURCE_TYPE.SLACK,
        sourceRef: messageTs, // only message timestamp, not message body
        status: TASK_CANDIDATE_STATUS.PENDING,
        createdAt: toIsoString(now),
        ttl: Math.floor(now.getTime() / 1000) + TASK_CANDIDATE_TTL_DAYS * 86400,
      },
    );

    logInfo({
      action: "extracted",
      candidateId,
      sourceRef: messageTs,
      bedrockDurationMs,
    });

    // text variable goes out of scope here; GC will collect it (DP-04)
    return { skipped: false, candidate };
  }

  /**
   * Build DynamoDB PK for a given userId
   * Used internally and exposed for testing convenience.
   */
  static buildPk(userId: string): string {
    return `${DDB_PREFIX.USER}${userId}`;
  }
}
