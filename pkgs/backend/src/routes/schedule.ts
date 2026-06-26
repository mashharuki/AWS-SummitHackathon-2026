/**
 * スケジュール（3バンドガント）生成ルート — U-G04
 *
 * GET /tasks/:taskId/schedule — タスクを AI が作業分解し、Google Calendar の
 *                               予定を避けてスケジューリングした SaboriSchedule を返す。
 *
 * 設計方針:
 * - SaboriSchedule は揮発データ（DynamoDB に保存しない）。
 *   生成のたびに「今この瞬間のカレンダー状況」に基づいて再計算する。
 * - カレンダー時間区間（busy slot）はその場限りで取得し、永続化しない（PII 保護 / DP-04）。
 * - カレンダー連携なし、または取得失敗時はフォールバック（busySlots=[] /
 *   calendarUsed=false）でスケジュール生成を続行する。エラーにしない。
 * - レスポンスは `Cache-Control: no-store` を付与する（揮発データのキャッシュ抑止）。
 *
 * 依存性注入:
 * - taskRepository / connectionRepository / schedulePlannerAgent を注入する。
 * - アクセストークン取得は `getAccessToken(userId): Promise<string>` として注入し、
 *   テストで Google トークン取得をモックできるようにする。
 *   デフォルト実装（GoogleTokenService 経由）は index.ts 側で渡す。
 */

import type { SchedulePlannerAgent, SchedulePlannerInput } from "@saboru/agent";
import type { BusySlot, Task } from "@saboru/shared";
import { toIsoString } from "@saboru/shared";
import { Hono } from "hono";
import { NotFoundError } from "../errors.js";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoServiceConnectionRepository } from "../repositories/DynamoServiceConnectionRepository.js";
import type { DynamoTaskRepository } from "../repositories/DynamoTaskRepository.js";
import { CalendarTimeslotService } from "../services/CalendarTimeslotService.js";
import type { AppEnv } from "../types.js";

function logInfo(data: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: "INFO", ...data }));
}

function logError(data: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: "ERROR", ...data }));
}

/** 締切不明時のデフォルト取得ウィンドウ（現在時刻 + 8h） */
const DEFAULT_WINDOW_MS = 8 * 60 * 60 * 1000;

/** 他タスクの意思決定を busy ブロック化するときの固定枠（分）。ガント描画と揃える。 */
const CROSS_TASK_DECISION_BLOCK_MIN = 10;

/**
 * 他タスクの「意思決定（decisionAt）」を、当タスクのガントの busy slot に変換する。
 *
 * SABOROU フェーズ2「タスク間でサボり時間を融通」の第一歩。確定時刻である意思決定
 * （例: 別タスクの 16:00 上司確認）だけを予定として相互反映する。作業時間は後ろ詰めで
 * 動的に決まる（永続化していない）ため含めない。
 *
 * @param otherTasks   同ユーザーの承認済みタスク（当タスク含む可・下で除外）
 * @param currentTaskId 当タスク ID（自分自身の予定は反映しない）
 * @param windowStart  取得ウィンドウ開始（ms）。これより前の意思決定は除外
 * @param windowEnd    取得ウィンドウ終了（ms）。これより後の意思決定は除外
 * @returns BusySlot 配列（10分固定枠・title は「予定: <ステップ名>」）
 */
export function buildCrossTaskDecisionSlots(
  otherTasks: Task[],
  currentTaskId: string,
  windowStart: number,
  windowEnd: number,
): BusySlot[] {
  const slots: BusySlot[] = [];
  const lenMs = CROSS_TASK_DECISION_BLOCK_MIN * 60_000;

  for (const task of otherTasks) {
    if (task.taskId === currentTaskId) continue; // 自分自身は除外
    if (!Array.isArray(task.plannedSteps)) continue;

    for (const step of task.plannedSteps) {
      if (step.bandType !== "decision" || !step.decisionAt) continue;
      const startMs = new Date(step.decisionAt).getTime();
      if (Number.isNaN(startMs)) continue;
      // ウィンドウ外（開始前 / 終了後）は反映しない
      if (startMs < windowStart || startMs >= windowEnd) continue;

      const label = step.stepLabel?.trim()
        ? `予定: ${step.stepLabel.trim()}`
        : "予定";
      slots.push({
        startAt: new Date(startMs).toISOString(),
        endAt: new Date(startMs + lenMs).toISOString(),
        title: label,
      });
    }
  }
  return slots;
}

/**
 * アクセストークン取得関数の型。
 * userId から有効な Google アクセストークンを返す。
 * 注入可能にしてテストで token 取得をモックできるようにする。
 */
export type GetAccessTokenFn = (userId: string) => Promise<string>;

export function createScheduleRoute(
  taskRepository: DynamoTaskRepository,
  connectionRepository: DynamoServiceConnectionRepository,
  schedulePlannerAgent: SchedulePlannerAgent,
  getAccessToken: GetAccessTokenFn,
  calendarTimeslotService: CalendarTimeslotService = new CalendarTimeslotService(),
): Hono<AppEnv> {
  const schedule = new Hono<AppEnv>();

  schedule.use("*", authMiddleware);

  /**
   * GET /tasks/:taskId/schedule
   *
   * 1. 認証（authMiddleware）→ userId
   * 2. taskRepository.findById で所有者確認（無ければ 404）
   * 3. Google 連携時はカレンダー busy 区間をその場で取得（失敗時はフォールバック）
   * 4. SchedulePlannerAgent.plan でスケジュールを生成
   * 5. Cache-Control: no-store を付けて { schedule } を返す
   */
  schedule.get("/:taskId/schedule", async (c) => {
    const userId = c.get("userId");
    const taskId = c.req.param("taskId");

    // 所有者確認
    const task = await taskRepository.findById(userId, taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);

    // 取得ウィンドウ: now 〜 deadline（不明時は now + 8h）
    const now = new Date();
    const windowStartAt = toIsoString(now);
    const windowEndMs = task.deadline
      ? new Date(task.deadline).getTime()
      : now.getTime() + DEFAULT_WINDOW_MS;
    const windowEndAt = toIsoString(new Date(windowEndMs));

    // カレンダー時間区間の取得（その場限り・永続化しない）。
    // 連携なし or 取得失敗時はフォールバックで空配列のまま続行する。
    let busySlots: BusySlot[] = [];
    let calendarUsed = false;

    try {
      const connection = await connectionRepository.findByUserAndService(
        userId,
        "google",
      );
      if (connection && connection.status === "connected") {
        const accessToken = await getAccessToken(userId);
        busySlots = await calendarTimeslotService.fetchBusySlots({
          accessToken,
          windowStartAt,
          windowEndAt,
        });
        calendarUsed = true;
      }
    } catch (err) {
      // フォールバック: カレンダー取得失敗時はエラーにせず空のまま続行する
      logError({
        action: "schedule_calendar_fetch_failed",
        taskId,
        error: String(err),
      });
      busySlots = [];
      calendarUsed = false;
    }

    // 他タスクの意思決定（decisionAt）を予定（busy）として反映する。
    // SABOROU フェーズ2「タスク間でサボり時間を融通」。取得失敗は握りつぶして続行。
    let crossTaskSlotCount = 0;
    try {
      const otherTasks = await taskRepository.findApprovedByUserId(userId);
      const crossTaskSlots = buildCrossTaskDecisionSlots(
        otherTasks,
        taskId,
        now.getTime(),
        windowEndMs,
      );
      crossTaskSlotCount = crossTaskSlots.length;
      busySlots = [...busySlots, ...crossTaskSlots];
    } catch (err) {
      logError({
        action: "schedule_cross_task_fetch_failed",
        taskId,
        error: String(err),
      });
    }

    // スケジュール生成
    const input: SchedulePlannerInput = {
      task,
      busySlots,
      calendarUsed,
      now: windowStartAt,
    };
    let result: Awaited<ReturnType<typeof schedulePlannerAgent.plan>>;
    try {
      result = await schedulePlannerAgent.plan(input);
    } catch (err) {
      logError({
        action: "schedule_plan_failed",
        taskId,
        error: String(err),
      });
      return c.json(
        {
          error: {
            code: "SCHEDULE_GENERATION_FAILED",
            message: "スケジュール生成に失敗しました。しばらくしてから再試行してください。",
          },
        },
        503,
      );
    }

    logInfo({
      action: "schedule_generated",
      taskId,
      calendarUsed,
      busySlotCount: busySlots.length,
      crossTaskSlotCount,
      blockCount: result.blocks.length,
    });

    // 揮発データはキャッシュさせない
    c.header("Cache-Control", "no-store");
    return c.json({ schedule: result });
  });

  return schedule;
}
