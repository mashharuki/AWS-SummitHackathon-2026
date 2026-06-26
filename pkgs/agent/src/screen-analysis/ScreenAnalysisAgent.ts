import { BedrockTimeoutError } from "@saboru/shared";
import type { ImageFormat } from "@aws-sdk/client-bedrock-runtime";
import type { IBedrockClient } from "../bedrock/IBedrockClient.js";
import { logError, logInfo } from "../utils/logger.js";
import {
  SCREEN_MATCH_SYSTEM_PROMPT,
  SCREEN_MATCH_TOOL,
  SCREEN_MATCH_TOOL_NAME,
  type ScreenMatchOutput,
  ScreenMatchSchema,
} from "./screenAnalysisTool.js";

/**
 * ScreenAnalysisAgent — スクリーンショット判定エンジン（余白タブ復帰チェック用）
 *
 * Converse API に画像（image ブロック）を渡し、その画面が次タスクの作業画面かを
 * 判定する。toolChoice 強制 + Zod 検証で構造化出力を返す。
 *
 * 既存 Agent（V2 等）と同じ作法（IBedrockClient.converse / SONNET_MODEL_ID /
 * tool use なし時 BedrockTimeoutError）を踏襲する。
 */

const SONNET_MODEL_ID = "jp.anthropic.claude-sonnet-4-6";

export interface ScreenAnalysisInput {
  /** スクリーンショットの画像バイト列 */
  imageBytes: Uint8Array;
  /** 画像フォーマット（jpeg / png 等） */
  format: ImageFormat;
  /** 次タスクの期待タイトル */
  expectedTitle: string;
  /** タブの title / URL など補足文脈。任意 */
  pageHint?: string;
}

export class ScreenAnalysisAgent {
  constructor(private readonly bedrock: IBedrockClient) {}

  /**
   * analyzeScreenshot() — スクリーンショットが次タスクの作業画面か判定する。
   */
  async analyzeScreenshot(
    input: ScreenAnalysisInput,
  ): Promise<ScreenMatchOutput> {
    const startMs = Date.now();

    const promptLines = [
      `次タスクのタイトル: ${input.expectedTitle.replace(/[\r\n]+/g, " ")}`,
    ];
    if (input.pageHint) {
      promptLines.push(
        `現在のタブ情報（参考）: ${input.pageHint.replace(/[\r\n]+/g, " ").slice(0, 300)}`,
      );
    }
    promptLines.push(
      "このスクリーンショットが、上記の次タスクの作業に取りかかっている画面かどうかを screen_match ツールで判定してください。",
    );

    const response = await this.bedrock.converse({
      modelId: SONNET_MODEL_ID,
      system: [{ text: SCREEN_MATCH_SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: [
            { text: promptLines.join("\n") },
            {
              image: {
                format: input.format,
                source: { bytes: input.imageBytes },
              },
            },
          ],
        },
      ],
      toolConfig: {
        tools: [SCREEN_MATCH_TOOL],
        toolChoice: { tool: { name: SCREEN_MATCH_TOOL_NAME } },
      },
      inferenceConfig: {
        maxTokens: 256,
        temperature: 0,
      },
    });

    const durationMs = Date.now() - startMs;

    const toolUseBlock = response.output?.message?.content?.find(
      (block) => block.toolUse?.name === SCREEN_MATCH_TOOL_NAME,
    );

    if (!toolUseBlock?.toolUse?.input) {
      logError({
        action: "screen_match_no_tool_use",
        stopReason: response.stopReason,
        durationMs,
      });
      throw new BedrockTimeoutError(
        `Bedrock did not return screen_match tool use (stopReason: ${response.stopReason})`,
      );
    }

    const parseResult = ScreenMatchSchema.safeParse(toolUseBlock.toolUse.input);
    if (!parseResult.success) {
      logError({
        action: "screen_match_invalid_output",
        issues: parseResult.error.issues,
        durationMs,
      });
      throw new Error("Bedrock screen_match output failed schema validation");
    }

    logInfo({
      action: "screen_match_complete",
      matched: parseResult.data.matched,
      confidence: parseResult.data.confidence,
      durationMs,
      inputTokens: response.usage?.inputTokens,
      outputTokens: response.usage?.outputTokens,
    });

    return parseResult.data;
  }
}
