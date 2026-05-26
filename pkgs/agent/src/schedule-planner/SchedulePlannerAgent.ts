import type { BusySlot, SaboriSchedule, Task } from "@saboru/shared";
import { toIsoString } from "@saboru/shared";
import type { IBedrockClient } from "../bedrock/IBedrockClient.js";
import { logError, logInfo } from "../utils/logger.js";
import { calcSchedule, resolveWindowEnd } from "./saboruBlockCalc.js";
import {
  PLAN_SCHEDULE_TOOL,
  PLAN_SCHEDULE_TOOL_NAME,
  PlanScheduleOutputSchema,
  SCHEDULE_SYSTEM_PROMPT,
} from "./tools.js";

/**
 * AP クロスリージョン推論プロファイル ID。
 * 判定エージェントと同じ Sonnet 4.6 を使用する。
 */
const MODEL_ID = "jp.anthropic.claude-sonnet-4-6";

/**
 * SchedulePlannerAgent — 段取り逆算エージェント
 *
 * 責務:
 * 1. Bedrock converse + toolChoice 強制で作業ステップ分解を取得（DP-02）
 * 2. Zod で出力をバリデーション（DP-03）
 * 3. カレンダー busy 区間を避けてステップを配置し、空き時間を「さぼろう」帯にする
 *    （saboruBlockCalc による決定論的算出）
 * 4. SaboriSchedule を組み立てて返す（永続化しない揮発データ）
 */
export interface SchedulePlannerInput {
  task: Task;
  /** カレンダー予定の時間区間（未連携時は空配列） */
  busySlots: BusySlot[];
  /** カレンダーを実際に使ったか（false=未連携 or ダミー） */
  calendarUsed: boolean;
  /** 現在時刻 ISO（省略時は実行時の現在時刻） */
  now?: string;
}

export class SchedulePlannerAgent {
  constructor(private readonly bedrock: IBedrockClient) {}

  /**
   * タスクからサボリスケジュール（3バンドガント）を生成する。
   */
  async plan(input: SchedulePlannerInput): Promise<SaboriSchedule> {
    const { task, busySlots, calendarUsed } = input;
    const now = input.now ?? toIsoString(new Date());
    const startMs = Date.now();

    // フェーズ 1: Bedrock で作業ステップ分解
    const steps = await this.runPlanPhase(task);

    // フェーズ 2: 決定論的にカレンダーを避けて配置 + さぼろう帯算出
    const { blocks, totalSaboruMinutes } = calcSchedule({
      steps,
      busySlots,
      now,
      deadline: task.deadline,
    });

    // ガント表示窓
    const windowStartMs = new Date(now).getTime();
    const totalWorkMin = steps.reduce((s, st) => s + st.durationMinutes, 0);
    const windowEndMs = resolveWindowEnd(
      windowStartMs,
      task.deadline,
      totalWorkMin,
    );

    const schedule: SaboriSchedule = {
      taskId: task.taskId,
      generatedAt: toIsoString(new Date()),
      viewStartAt: toIsoString(new Date(windowStartMs)),
      viewEndAt: toIsoString(new Date(windowEndMs)),
      deadline: task.deadline,
      blocks,
      totalSaboruMinutes,
      calendarUsed,
    };

    logInfo({
      action: "schedule_plan_complete",
      taskId: task.taskId,
      stepCount: steps.length,
      totalSaboruMinutes,
      calendarUsed,
      totalMs: Date.now() - startMs,
    });

    return schedule;
  }

  /**
   * フェーズ 1: Bedrock converse（toolChoice 強制）で作業ステップを取得する。
   */
  private async runPlanPhase(task: Task) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const deadlineText = task.deadline
      ? `締切: ${task.deadline}`
      : "締切: 未定";

    // task.description はユーザー/外部由来のため、改行を除去してインジェクション対策
    const safeDescription = task.description
      .replace(/[\r\n]+/g, " ")
      .slice(0, 1000);
    const safeTitle = task.title.replace(/[\r\n]+/g, " ").slice(0, 200);

    const response = await this.bedrock.converse({
      modelId: MODEL_ID,
      system: [{ text: SCHEDULE_SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: [
            {
              text: [
                `今日は ${todayIso}（Asia/Tokyo）です。`,
                "次のタスクを作業ステップに分解してください。",
                "",
                `タイトル: ${safeTitle}`,
                deadlineText,
                `内容: ${safeDescription || "（詳細なし）"}`,
              ].join("\n"),
            },
          ],
        },
      ],
      toolConfig: {
        tools: [PLAN_SCHEDULE_TOOL],
        toolChoice: { tool: { name: PLAN_SCHEDULE_TOOL_NAME } },
      },
      inferenceConfig: {
        maxTokens: 1024,
        temperature: 0,
      },
    });

    const toolUseBlock = response.output?.message?.content?.find(
      (block) => block.toolUse?.name === PLAN_SCHEDULE_TOOL_NAME,
    );

    if (!toolUseBlock?.toolUse?.input) {
      logError({
        action: "schedule_plan_no_tool_use",
        stopReason: response.stopReason,
        taskId: task.taskId,
      });
      throw new Error(
        `Bedrock did not return plan_schedule tool use (stopReason: ${response.stopReason})`,
      );
    }

    const parsed = PlanScheduleOutputSchema.safeParse(
      toolUseBlock.toolUse.input,
    );
    if (!parsed.success) {
      logError({
        action: "schedule_plan_invalid_output",
        issues: parsed.error.issues,
        taskId: task.taskId,
      });
      throw new Error("plan_schedule output failed schema validation");
    }

    return parsed.data.steps;
  }
}
