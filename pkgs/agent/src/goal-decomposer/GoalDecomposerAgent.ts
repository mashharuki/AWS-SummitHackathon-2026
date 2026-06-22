import { toIsoString } from "@saboru/shared";
import type { IBedrockClient } from "../bedrock/IBedrockClient.js";
import { logError, logInfo } from "../utils/logger.js";
import {
  GOAL_DECOMPOSER_SYSTEM_PROMPT,
  WBS_DECOMPOSE_TOOL,
  WBS_DECOMPOSE_TOOL_NAME,
  WbsDecomposeOutputSchema,
} from "./tools.js";
import type { GoalAnalysis, SubTask } from "./types.js";

/** 1日の稼働時間（分）= 8h - 1h昼休み */
const WORK_MINUTES_PER_DAY = 480;

const MODEL_ID = "jp.anthropic.claude-sonnet-4-6";

export interface GoalDecomposerInput {
  taskId: string;
  title: string;
  description: string;
  deadline: string | null;
  /** Slack文脈 (直近メッセージの傾向・キーワード)。省略時はデフォルト提案 */
  slackContext?: string;
  /** 現在時刻ISO (省略時は実行時) */
  now?: string;
}

/**
 * GoalDecomposerAgent — PM WBS分解エージェント
 *
 * PMBOK 8th Edition WBS手法でタスクをサブタスクに分解し、
 * ガントチャート用のGoalAnalysisを返す。
 *
 * 設計:
 * - SchedulePlannerAgentと同じパターン (toolChoice.tool強制 + Zod検証)
 * - Bedrockへの依存はIBedrockClientで抽象化 (テスト容易性)
 */
export class GoalDecomposerAgent {
  constructor(private readonly bedrock: IBedrockClient) {}

  async decompose(input: GoalDecomposerInput): Promise<GoalAnalysis> {
    const now = input.now ?? toIsoString(new Date());
    const startMs = Date.now();

    const userMessage = this.buildUserMessage(input);

    logInfo({
      action: "goal_decomposer_start",
      taskId: input.taskId,
      title: input.title,
    });

    const response = await this.bedrock.converse({
      modelId: MODEL_ID,
      system: [{ text: GOAL_DECOMPOSER_SYSTEM_PROMPT }],
      messages: [{ role: "user", content: [{ text: userMessage }] }],
      toolConfig: {
        tools: [WBS_DECOMPOSE_TOOL],
        toolChoice: { tool: { name: WBS_DECOMPOSE_TOOL_NAME } },
      },
      inferenceConfig: {
        maxTokens: 2048,
        temperature: 0.3,
      },
    });

    const toolUse = response.output?.message?.content?.find(
      (block) => block.toolUse?.name === WBS_DECOMPOSE_TOOL_NAME,
    )?.toolUse;

    if (!toolUse?.input) {
      throw new Error("Bedrock did not return expected tool use block");
    }

    const parsed = WbsDecomposeOutputSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      logError({
        action: "goal_decomposer_validation_error",
        taskId: input.taskId,
        error: parsed.error.message,
      });
      throw new Error(`WBS decomposition validation failed: ${parsed.error.message}`);
    }

    const raw = parsed.data;
    const totalEstimatedMinutes = raw.subtasks.reduce(
      (sum, st) => sum + st.estimatedMinutes,
      0,
    );
    const freeTimeMinutes = Math.max(0, WORK_MINUTES_PER_DAY - totalEstimatedMinutes);

    const subtasks: SubTask[] = raw.subtasks.map((st, idx) => ({
      id: st.id,
      taskId: input.taskId,
      title: st.title,
      description: st.description,
      estimatedMinutes: st.estimatedMinutes,
      saborouType: st.saborouType,
      status: "pending",
      order: idx,
    }));

    const goalAnalysis: GoalAnalysis = {
      goalSummary: raw.goalSummary,
      deliverable: raw.deliverable,
      subtasks,
      totalEstimatedMinutes,
      freeTimeMinutes,
      freeTimeSuggestion: raw.freeTimeSuggestion,
      generatedAt: now,
    };

    logInfo({
      action: "goal_decomposer_complete",
      taskId: input.taskId,
      subtaskCount: subtasks.length,
      totalEstimatedMinutes,
      freeTimeMinutes,
      durationMs: Date.now() - startMs,
    });

    return goalAnalysis;
  }

  private buildUserMessage(input: GoalDecomposerInput): string {
    const lines: string[] = [
      `タスク: ${input.title}`,
      `内容: ${input.description || "（詳細未設定）"}`,
      `締切: ${input.deadline ?? "未設定"}`,
    ];

    if (input.slackContext) {
      lines.push(`Slack文脈（ユーザーの最近のメッセージパターン）:\n${input.slackContext}`);
    } else {
      lines.push("Slack文脈: 不明（一般的な余白提案を使用してください）");
    }

    lines.push("\n上記タスクをWBSで分解し、wbs_decomposeツールを呼び出してください。");

    return lines.join("\n");
  }
}
