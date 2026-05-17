import type { IBedrockClient } from "../bedrock/IBedrockClient.js";
import { logError, logInfo } from "../utils/logger.js";
import {
  PERSONA_RENDER_TOOL,
  PERSONA_RENDER_TOOL_NAME,
  RenderOutputSchema,
  SABORU_OTTORI_SYSTEM_PROMPT,
  VERDICT_META,
} from "./personaRenderTool.js";
import type { RenderInput, RenderOutput } from "./types.js";

/**
 * PersonaRenderer — フェーズ 3 口調変換エージェント (AG-03)
 *
 * Claude Haiku (短文変換にコスト最適化) を使用して、中立的な LLM の
 * rawChatMessage をサボロー口調に変換する。
 *
 * モデル: anthropic.claude-haiku-3-5-20241022-v1:0
 * maxTokens: 256 (口調変換は出力が短い)
 * temperature: 0.3 (自然に聞こえる口調のためわずかな創造性)
 *
 * フォールバック: Haiku 呼び出し失敗時は rawChatMessage をそのまま使用 (NFR: グレースフルデグレード)
 */

const HAIKU_MODEL_ID = "anthropic.claude-haiku-3-5-20241022-v1:0";

export class PersonaRenderer {
  constructor(private readonly bedrock: IBedrockClient) {}

  /**
   * LLM 判定を口調変換済み出力にレンダリングする
   *
   * @param input - verdict, reasoning, summaryText, rawChatMessage を持つ RenderInput
   * @returns 口調変換済み chatMessage と verdictEmoji を持つ RenderOutput
   */
  async render(input: RenderInput): Promise<RenderOutput> {
    const verdictMeta = VERDICT_META[input.verdict] ?? {
      emoji: "🤔",
      label: "確認中",
    };

    const startMs = Date.now();

    try {
      const response = await this.bedrock.converse({
        modelId: HAIKU_MODEL_ID,
        system: [{ text: SABORU_OTTORI_SYSTEM_PROMPT }],
        messages: [
          {
            role: "user",
            content: [
              {
                text: [
                  `判定結果: ${input.verdict}`,
                  `サマリ（中立口調）: ${input.summaryText}`,
                  `チャットメッセージ（中立口調）: ${input.rawChatMessage}`,
                  "",
                  "上記の内容を、サボロー口調に変換して persona_render ツールで返してください。",
                ].join("\n"),
              },
            ],
          },
        ],
        toolConfig: {
          tools: [PERSONA_RENDER_TOOL],
          toolChoice: {
            tool: { name: PERSONA_RENDER_TOOL_NAME },
          },
        },
        inferenceConfig: {
          maxTokens: 256,
          temperature: 0.3,
        },
      });

      const haikuDurationMs = Date.now() - startMs;

      // Extract tool use block
      const toolUseBlock = response.output?.message?.content?.find(
        (block) => block.toolUse?.name === PERSONA_RENDER_TOOL_NAME,
      );

      if (!toolUseBlock?.toolUse?.input) {
        logError({
          action: "persona_renderer_no_tool_use",
          stopReason: response.stopReason,
          haikuDurationMs,
        });
        // Fallback: use rawChatMessage without tone conversion
        return this.buildFallbackOutput(input, verdictMeta);
      }

      // Zod validation
      const parseResult = RenderOutputSchema.safeParse(
        toolUseBlock.toolUse.input,
      );
      if (!parseResult.success) {
        logError({
          action: "persona_renderer_invalid_output",
          issues: parseResult.error.issues,
          haikuDurationMs,
        });
        return this.buildFallbackOutput(input, verdictMeta);
      }

      logInfo({
        action: "persona_rendered",
        verdict: input.verdict,
        personaId: input.personaId,
        haikuDurationMs,
      });

      return {
        summaryText: parseResult.data.summaryText,
        chatMessage: parseResult.data.chatMessage,
        verdictEmoji: verdictMeta.emoji,
        verdictLabel: verdictMeta.label,
        personaId: input.personaId,
      };
    } catch (error) {
      const haikuDurationMs = Date.now() - startMs;
      logError({
        action: "persona_renderer_error",
        error: error instanceof Error ? error.message : String(error),
        haikuDurationMs,
      });
      // Graceful degradation: return rawChatMessage unchanged
      return this.buildFallbackOutput(input, verdictMeta);
    }
  }

  /**
   * Fallback output when Haiku fails — uses rawChatMessage without tone conversion
   */
  private buildFallbackOutput(
    input: RenderInput,
    verdictMeta: { emoji: string; label: string },
  ): RenderOutput {
    return {
      summaryText: input.summaryText,
      chatMessage: input.rawChatMessage,
      verdictEmoji: verdictMeta.emoji,
      verdictLabel: verdictMeta.label,
      personaId: input.personaId,
    };
  }
}
