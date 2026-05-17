import type { IProposalRepository, Proposal } from "@saboru/shared";
import {
  DEFAULT_PERSONA_ID,
  BedrockTimeoutError,
  toIsoString,
} from "@saboru/shared";
import type { IBedrockClient } from "../bedrock/IBedrockClient.js";
import { logError, logInfo } from "../utils/logger.js";
import type { PersonaRenderer } from "./PersonaRenderer.js";
import type {
  ContextSignals,
  LLMJudgment,
  ProposalDelta,
  TaskContext,
} from "./types.js";
import {
  SABORI_JUDGMENT_TOOL,
  SABORI_JUDGMENT_TOOL_NAME,
  SABORI_SYSTEM_PROMPT,
  LLMJudgmentSchema,
} from "./saboriJudgmentTool.js";
import {
  assembleContextNarrative,
  calcNextCheckAt,
  deriveContextSignals,
} from "./contextUtils.js";

/**
 * SaboriProposerAgent — Core 3-phase judgment engine (AG-02)
 *
 * Phase 1: Context assembly
 *   - assembleContextNarrative(): natural language narrative from TaskContext
 *   - deriveContextSignals(): 5 psychological framework signal derivation
 *
 * Phase 2: Bedrock converse (sabori_judgment Tool Use)
 *   - Model: us.anthropic.claude-3-5-sonnet-20241022-v2:0 (Sonnet 3.5)
 *   - maxTokens: 1024, temperature: 0 (deterministic judgment)
 *   - Forced toolChoice for structured LLMJudgment output
 *
 * Phase 3: PersonaRenderer (tone conversion)
 *   - Model: anthropic.claude-haiku-3-5-20241022-v1:0 (Haiku)
 *   - maxTokens: 256, temperature: 0.3 (slight creativity)
 *   - Converts neutral rawChatMessage to Saboru ottori persona
 */

/**
 * Model ID for cross-region inference (ap-northeast-1 → us-east-1 fallback)
 * IAM resource ARN uses base model ID without "us." prefix.
 */
const SONNET_MODEL_ID = "us.anthropic.claude-3-5-sonnet-20241022-v2:0";

export class SaboriProposerAgent {
  constructor(
    private readonly bedrock: IBedrockClient,
    private readonly proposalRepository: IProposalRepository,
    private readonly personaRenderer: PersonaRenderer,
  ) {}

  /**
   * propose() — Synchronous (non-streaming) sabori judgment
   *
   * Executes 3 phases and persists the Proposal to DynamoDB.
   *
   * @param taskId - Task ID for Proposal PK key
   * @param context - TaskContext with task + optional slackContext
   * @returns Persisted Proposal
   */
  async propose(taskId: string, context: TaskContext): Promise<Proposal> {
    const startMs = Date.now();

    // Phase 1: Context assembly
    const narrativeText = assembleContextNarrative(context);
    const contextSignals = deriveContextSignals(context);

    logInfo({
      action: "sabori_propose_start",
      taskId,
      contextCoverage: contextSignals.contextCoverage,
      userId: context.task.userId,
    });

    // Phase 2: Bedrock converse (Sonnet)
    const judgment = await this.runJudgmentPhase(narrativeText, contextSignals);

    // Phase 3: PersonaRenderer (Haiku)
    const rendered = await this.personaRenderer.render({
      verdict: judgment.verdict,
      reasoning: judgment.reasoning,
      summaryText: judgment.summaryText,
      rawChatMessage: judgment.rawChatMessage,
      personaId: DEFAULT_PERSONA_ID,
    });

    // Final assembly
    const now = new Date();
    const evaluatedAt = toIsoString(now);
    const nextCheckAt = calcNextCheckAt(judgment.nextCheckOffsetMinutes, now);

    const proposalInput: Omit<Proposal, "PK" | "SK"> = {
      taskId,
      userId: context.task.userId,
      verdict: judgment.verdict,
      summaryText: rendered.summaryText,
      reasoning: judgment.reasoning,
      chatMessage: rendered.chatMessage,
      personaId: rendered.personaId,
      evaluatedAt,
      nextCheckAt,
      tokenCount: 0, // will be set below via usage
    };

    // Note: tokenCount is set after repository save since we need usage from Phase 2+3
    // For MVP, set approximate count from Phase 2 only
    // (Phase 3 Haiku tokens are small and tracked separately in logs)
    const proposal = await this.proposalRepository.save(proposalInput);

    const totalMs = Date.now() - startMs;
    logInfo({
      action: "sabori_propose_complete",
      taskId,
      verdict: judgment.verdict,
      totalMs,
    });

    return proposal;
  }

  /**
   * proposeStream() — Streaming sabori judgment via AsyncIterator
   *
   * Yields ProposalDelta events as judgment progresses.
   * PersonaRenderer runs after stream completes (non-streaming Haiku call).
   *
   * Note: Uses converseStream from IBedrockClient for Phase 2.
   * Phase 3 (PersonaRenderer) runs after stream completion.
   */
  async *proposeStream(
    taskId: string,
    context: TaskContext,
  ): AsyncGenerator<ProposalDelta> {
    const startMs = Date.now();

    // Phase 1: Context assembly
    const narrativeText = assembleContextNarrative(context);
    const contextSignals = deriveContextSignals(context);

    logInfo({
      action: "sabori_propose_stream_start",
      taskId,
      contextCoverage: contextSignals.contextCoverage,
    });

    // Phase 2: Bedrock converseStream
    let fullText = "";
    try {
      const streamResponse = await this.bedrock.converseStream({
        modelId: SONNET_MODEL_ID,
        system: [{ text: SABORI_SYSTEM_PROMPT }],
        messages: [
          {
            role: "user",
            content: [{ text: narrativeText }],
          },
        ],
        toolConfig: {
          tools: [SABORI_JUDGMENT_TOOL],
          toolChoice: {
            tool: { name: SABORI_JUDGMENT_TOOL_NAME },
          },
        },
        inferenceConfig: {
          maxTokens: 1024,
          temperature: 0,
        },
      });

      if (streamResponse.stream) {
        for await (const event of streamResponse.stream) {
          if (event.contentBlockDelta?.delta?.toolUse?.input) {
            const chunk = event.contentBlockDelta.delta.toolUse.input;
            fullText += chunk;
            yield {
              type: "chat_message_chunk",
              payload: chunk,
            };
          }
        }
      }
    } catch (error) {
      logError({
        action: "sabori_propose_stream_error",
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BedrockTimeoutError("Streaming judgment failed");
    }

    // Parse full accumulated JSON (tool use input)
    let judgment: LLMJudgment;
    try {
      const parsed = JSON.parse(fullText) as unknown;
      const result = LLMJudgmentSchema.safeParse(parsed);
      if (!result.success) {
        throw new Error("Streaming output failed Zod validation");
      }
      judgment = result.data;
    } catch (error) {
      logError({
        action: "sabori_propose_stream_parse_error",
        error: error instanceof Error ? error.message : String(error),
        fullText: fullText.slice(0, 200),
      });
      // Fallback to synchronous judgment
      judgment = await this.runJudgmentPhase(narrativeText, contextSignals);
    }

    yield {
      type: "verdict",
      payload: judgment.verdict,
    };

    for (const item of judgment.reasoning) {
      yield {
        type: "reasoning_item",
        payload: item,
      };
    }

    // Phase 3: PersonaRenderer (non-streaming)
    const rendered = await this.personaRenderer.render({
      verdict: judgment.verdict,
      reasoning: judgment.reasoning,
      summaryText: judgment.summaryText,
      rawChatMessage: judgment.rawChatMessage,
      personaId: DEFAULT_PERSONA_ID,
    });

    // Final assembly and persist
    const now = new Date();
    const evaluatedAt = toIsoString(now);
    const nextCheckAt = calcNextCheckAt(judgment.nextCheckOffsetMinutes, now);

    const proposalInput: Omit<Proposal, "PK" | "SK"> = {
      taskId,
      userId: context.task.userId,
      verdict: judgment.verdict,
      summaryText: rendered.summaryText,
      reasoning: judgment.reasoning,
      chatMessage: rendered.chatMessage,
      personaId: rendered.personaId,
      evaluatedAt,
      nextCheckAt,
      tokenCount: 0,
    };

    const proposal = await this.proposalRepository.save(proposalInput);

    const totalMs = Date.now() - startMs;
    logInfo({
      action: "sabori_propose_stream_complete",
      taskId,
      verdict: judgment.verdict,
      totalMs,
    });

    yield {
      type: "complete",
      payload: proposal,
    };
  }

  /**
   * Phase 2: Run sabori judgment via Bedrock converse (synchronous)
   *
   * @param narrativeText - Assembled context narrative
   * @param contextSignals - Derived psychological signals (for logging)
   * @returns Validated LLMJudgment
   */
  private async runJudgmentPhase(
    narrativeText: string,
    contextSignals: ContextSignals,
  ): Promise<LLMJudgment> {
    const startMs = Date.now();

    const response = await this.bedrock.converse({
      modelId: SONNET_MODEL_ID,
      system: [{ text: SABORI_SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: [{ text: narrativeText }],
        },
      ],
      toolConfig: {
        tools: [SABORI_JUDGMENT_TOOL],
        toolChoice: {
          tool: { name: SABORI_JUDGMENT_TOOL_NAME },
        },
      },
      inferenceConfig: {
        maxTokens: 1024,
        temperature: 0,
      },
    });

    const sonnetDurationMs = Date.now() - startMs;

    // Extract tool use block
    const toolUseBlock = response.output?.message?.content?.find(
      (block) => block.toolUse?.name === SABORI_JUDGMENT_TOOL_NAME,
    );

    if (!toolUseBlock?.toolUse?.input) {
      logError({
        action: "sabori_judgment_no_tool_use",
        stopReason: response.stopReason,
        contextCoverage: contextSignals.contextCoverage,
        sonnetDurationMs,
      });
      throw new BedrockTimeoutError(
        `Bedrock did not return sabori_judgment tool use (stopReason: ${response.stopReason})`,
      );
    }

    // Zod validation
    const parseResult = LLMJudgmentSchema.safeParse(toolUseBlock.toolUse.input);
    if (!parseResult.success) {
      logError({
        action: "sabori_judgment_invalid_output",
        issues: parseResult.error.issues,
        sonnetDurationMs,
      });
      throw new Error(
        "Bedrock sabori_judgment output failed schema validation",
      );
    }

    logInfo({
      action: "sabori_judgment_complete",
      verdict: parseResult.data.verdict,
      appliedFramework: parseResult.data.appliedFramework,
      sonnetDurationMs,
      inputTokens: response.usage?.inputTokens,
      outputTokens: response.usage?.outputTokens,
    });

    return parseResult.data;
  }
}
