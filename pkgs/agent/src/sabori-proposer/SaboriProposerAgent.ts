import type { IProposalRepository, Proposal } from "@saboru/shared";
import {
  BedrockTimeoutError,
  DEFAULT_PERSONA_ID,
  toIsoString,
} from "@saboru/shared";
import type { IBedrockClient } from "../bedrock/IBedrockClient.js";
import { logError, logInfo } from "../utils/logger.js";
import type { PersonaRenderer } from "./PersonaRenderer.js";
import {
  assembleContextNarrative,
  calcNextCheckAt,
  deriveContextSignals,
} from "./contextUtils.js";
import {
  LLMJudgmentSchema,
  SABORI_JUDGMENT_TOOL,
  SABORI_JUDGMENT_TOOL_NAME,
  SABORI_SYSTEM_PROMPT,
} from "./saboriJudgmentTool.js";
import type {
  ContextSignals,
  LLMJudgment,
  ProposalDelta,
  TaskContext,
} from "./types.js";

/**
 * SaboriProposerAgent — コア 3 フェーズ判定エンジン (AG-02)
 *
 * フェーズ 1: コンテキスト組み立て
 *   - assembleContextNarrative(): TaskContext から自然言語ナラティブを生成
 *   - deriveContextSignals(): 5 つの心理学的フレームワークシグナルを導出
 *
 * フェーズ 2: Bedrock converse (sabori_judgment Tool Use)
 *   - モデル: us.anthropic.claude-3-5-sonnet-20241022-v2:0 (Sonnet 3.5)
 *   - maxTokens: 1024, temperature: 0 (決定論的判定)
 *   - 構造化 LLMJudgment 出力のため toolChoice を強制
 *
 * フェーズ 3: PersonaRenderer (口調変換)
 *   - モデル: anthropic.claude-haiku-3-5-20241022-v1:0 (Haiku)
 *   - maxTokens: 256, temperature: 0.3 (わずかな創造性)
 *   - 中立的な rawChatMessage をサボロー口調に変換
 */

/**
 * クロスリージョン推論のモデル ID (ap-northeast-1 → us-east-1 フォールバック)
 * IAM リソース ARN には "us." プレフィックスなしのベースモデル ID を使用する。
 */
const SONNET_MODEL_ID = "us.anthropic.claude-3-5-sonnet-20241022-v2:0";

export class SaboriProposerAgent {
  constructor(
    private readonly bedrock: IBedrockClient,
    private readonly proposalRepository: IProposalRepository,
    private readonly personaRenderer: PersonaRenderer,
  ) {}

  /**
   * propose() — 同期（非ストリーミング）サボリ判定
   *
   * 3 フェーズを実行して DynamoDB に Proposal を永続化する。
   *
   * @param taskId - Proposal PK キー用のタスク ID
   * @param context - task とオプションの slackContext を持つ TaskContext
   * @returns 永続化済み Proposal
   */
  async propose(taskId: string, context: TaskContext): Promise<Proposal> {
    const startMs = Date.now();

    // フェーズ 1: コンテキスト組み立て
    const narrativeText = assembleContextNarrative(context);
    const contextSignals = deriveContextSignals(context);

    logInfo({
      action: "sabori_propose_start",
      taskId,
      contextCoverage: contextSignals.contextCoverage,
      userId: context.task.userId,
    });

    // フェーズ 2: Bedrock converse (Sonnet)
    const judgment = await this.runJudgmentPhase(narrativeText, contextSignals);

    // フェーズ 3: PersonaRenderer (Haiku)
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
      tokenCount: 0, // 下記の使用量からリポジトリ保存後に設定
    };

    // tokenCount はフェーズ 2+3 の使用量が必要なためリポジトリ保存後に設定
    // MVP ではフェーズ 2 のみのおよそのカウントを設定
    // (フェーズ 3 Haiku のトークンは少量でログで個別追跡)
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
   * proposeStream() — AsyncIterator 経由のストリーミングサボリ判定
   *
   * 判定の進行に合わせて ProposalDelta イベントを yield する。
   * PersonaRenderer はストリーム完了後に実行 (非ストリーミング Haiku 呼び出し)。
   *
   * 注意: フェーズ 2 で IBedrockClient の converseStream を使用する。
   * フェーズ 3 (PersonaRenderer) はストリーム完了後に実行する。
   */
  async *proposeStream(
    taskId: string,
    context: TaskContext,
  ): AsyncGenerator<ProposalDelta> {
    const startMs = Date.now();

    // フェーズ 1: コンテキスト組み立て
    const narrativeText = assembleContextNarrative(context);
    const contextSignals = deriveContextSignals(context);

    logInfo({
      action: "sabori_propose_stream_start",
      taskId,
      contextCoverage: contextSignals.contextCoverage,
    });

    // フェーズ 2: Bedrock converseStream
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

    // 完全に経結した JSON をパース (ツール使用入力)
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
        fullTextLength: fullText.length,
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

    // フェーズ 3: PersonaRenderer (非ストリーミング)
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
