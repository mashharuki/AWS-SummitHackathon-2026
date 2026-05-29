import type {
  BusySlot,
  SaboriSchedule,
  ScheduleStep,
  Task,
} from "@saboru/shared";
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
 * ステップ分解に必要なタスク情報の最小サブセット。
 *
 * `generateStepDraft` は承認前（候補段階）にも呼ばれるため、承認済み Task に
 * 限定せず、タイトル・締切・内容だけを受け取れるようにする。
 */
export interface StepDraftInput {
  title: string;
  deadline: string | null;
  description: string;
  /** 現在時刻 ISO（decisionAt 提案の基準。省略時は実行時の現在時刻） */
  now?: string;
  /** ログ用の識別子（候補 ID / タスク ID のいずれか。任意） */
  refId?: string;
}

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

    // フェーズ 1: 作業ステップを決定する。
    // ユーザーが承認モーダルで確定したステップ（task.plannedSteps）があれば
    // それをそのまま使い、Bedrock 再推論をスキップする（精度最大化の核 / E）。
    // 無い場合（このフィールド導入前の既存タスク等）は従来通り Bedrock で分解する。
    const hasConfirmedSteps =
      Array.isArray(task.plannedSteps) && task.plannedSteps.length > 0;
    const steps: ScheduleStep[] = hasConfirmedSteps
      ? (task.plannedSteps as ScheduleStep[])
      : await this.generateStepDraft({
          title: task.title,
          deadline: task.deadline,
          description: task.description,
          now,
          refId: task.taskId,
        });

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
      // ユーザー確認済みステップを使ったか（true=Bedrock 再推論スキップ）
      stepSource: hasConfirmedSteps ? "planned_steps" : "bedrock",
      totalSaboruMinutes,
      calendarUsed,
      totalMs: Date.now() - startMs,
    });

    return schedule;
  }

  /**
   * Bedrock converse（toolChoice 強制）で作業ステップ案を生成する。
   *
   * 用途:
   * - 承認モーダルのオープン時、ユーザーに見せる「やること」下書きの生成
   *   （POST /tasks/candidates/:id/plan-steps から呼ばれる）
   * - `plan()` 内で、確定済みステップが無い場合のフォールバック分解
   *
   * 失敗時は Error を投げる（呼び出し側でハンドリングする）。
   */
  async generateStepDraft(input: StepDraftInput): Promise<ScheduleStep[]> {
    const nowIso = input.now ?? toIsoString(new Date());
    const deadlineText = input.deadline
      ? `締切: ${input.deadline}`
      : "締切: 未定";

    // description / title はユーザー/外部由来のため、改行を除去してインジェクション対策
    const safeDescription = input.description
      .replace(/[\r\n]+/g, " ")
      .slice(0, 1000);
    const safeTitle = input.title.replace(/[\r\n]+/g, " ").slice(0, 200);

    const response = await this.bedrock.converse({
      modelId: MODEL_ID,
      system: [{ text: SCHEDULE_SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: [
            {
              text: [
                `現在時刻は ${nowIso}（Asia/Tokyo）です。`,
                "次のタスクを作業ステップに分解してください。",
                "",
                "【重要】decision ステップには decisionAt（ISO 8601 形式）を必ず付与してください。",
                "decisionAt は現在時刻より後・締切より前の具体的な時刻にすること。",
                '例: "2026-06-05T16:00:00+09:00"（上司確認は締切の2時間前など）',
                "decisionAt が欠けた decision ステップは不完全な出力です。",
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
        refId: input.refId,
      });
      throw new Error(
        `Bedrock did not return plan_schedule tool use (stopReason: ${response.stopReason})`,
      );
    }

    // LLM が返す decisionAt は形式が揺れる（オフセット付き / 秒なし / 全角等）。
    // safeParse 前に canonical ISO へ正規化し、解釈不能なら decisionAt を落として
    // バリデーション失敗（=503）を防ぐ。
    const normalizedInput = normalizeToolDecisionAt(toolUseBlock.toolUse.input);

    const parsed = PlanScheduleOutputSchema.safeParse(normalizedInput);
    if (!parsed.success) {
      logError({
        action: "schedule_plan_invalid_output",
        issues: parsed.error.issues,
        refId: input.refId,
      });
      throw new Error("plan_schedule output failed schema validation");
    }

    return parsed.data.steps;
  }
}

/**
 * Bedrock の plan_schedule ツール出力（未検証 raw）の各ステップ decisionAt を
 * canonical ISO（UTC, ミリ秒, Z）へ正規化する。解釈できない値は decisionAt を削除する。
 *
 * LLM は `2026-06-05T16:00:00+09:00` や `2026-06-05 16:00` など揺れた形式を返すため、
 * Zod 検証前にここで吸収して 503（検証失敗）を防ぐ。元オブジェクトは破壊しない。
 */
export function normalizeToolDecisionAt(rawInput: unknown): unknown {
  if (!rawInput || typeof rawInput !== "object") return rawInput;
  const obj = rawInput as { steps?: unknown };
  if (!Array.isArray(obj.steps)) return rawInput;

  const steps = obj.steps.map((step) => {
    /* c8 ignore next */
    if (!step || typeof step !== "object") return step;
    const s = step as Record<string, unknown>;
    if (typeof s.decisionAt !== "string") return step;
    const parsed = new Date(s.decisionAt);
    if (Number.isNaN(parsed.getTime())) {
      // 解釈不能: decisionAt を落とす（decision は durationMinutes で配置される）
      const { decisionAt: _drop, ...rest } = s;
      return rest;
    }
    return { ...s, decisionAt: parsed.toISOString() };
  });

  return { ...obj, steps };
}
