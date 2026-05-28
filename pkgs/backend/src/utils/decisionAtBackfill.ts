/**
 * decisionAtBackfill — 承認時 decisionAt 補完ユーティリティ
 *
 * decision ステップに decisionAt が欠けている場合、calcSchedule の後ろ詰め配置結果を
 * 用いて決定論的に補完する。承認保存パスとマイグレーションスクリプトの両方から使う。
 *
 * 設計方針:
 * - AI（Bedrock）が返した decisionAt を最優先し、欠けた場合のみ補完する。
 * - calcSchedule に busySlots=[] を渡す（承認時はカレンダー取得しない）。
 * - 補完は決定論的 ─ 同じ入力に対して必ず同じ時刻を返す。
 * - 元配列は破壊しない（イミュータブル）。
 * - calcSchedule 由来の ScheduleBlock の startAt を decisionAt として使う。
 */

import { calcSchedule } from "@saboru/agent";
import type { ScheduleStep } from "@saboru/shared";

export interface BackfillResult {
  /** 補完後のステップ配列（元配列と同長・同順）*/
  steps: ScheduleStep[];
  /** 補完が実際に行われたステップ数 */
  backfilledCount: number;
}

/**
 * plannedSteps の decision ステップに decisionAt が欠けている場合、
 * calcSchedule の後ろ詰め配置時刻で補完して返す。
 *
 * @param steps    元の plannedSteps（変更しない）
 * @param now      現在時刻 ISO（補完計算の基準時刻）
 * @param deadline タスクの締切 ISO / null
 * @returns 補完結果（steps は常に元と同長・同順、decisionAt が埋まった状態）
 */
export function backfillDecisionAt(
  steps: ScheduleStep[],
  now: string,
  deadline: string | null,
): BackfillResult {
  // 補完が必要な decision ステップが存在するか確認
  const needsBackfill = steps.some(
    (s) => s.bandType === "decision" && !s.decisionAt,
  );
  if (!needsBackfill) {
    return { steps, backfilledCount: 0 };
  }

  // calcSchedule で後ろ詰め配置を計算（busySlots=[] で確定論的に動作）
  const { blocks } = calcSchedule({
    steps,
    busySlots: [],
    now,
    deadline,
  });

  // ブロック配置結果を stepId でインデックス化
  const blockByStepId = new Map<string, { startAt: string }>();
  for (const block of blocks) {
    if (block.bandType === "decision") {
      blockByStepId.set(block.stepId, { startAt: block.startAt });
    }
  }

  let backfilledCount = 0;
  const patchedSteps: ScheduleStep[] = steps.map((step) => {
    if (step.bandType !== "decision" || step.decisionAt) {
      // decision でない、または既に decisionAt がある → そのまま
      return step;
    }
    const block = blockByStepId.get(step.stepId);
    if (!block) {
      // calcSchedule 結果に対応するブロックが見つからない場合は補完しない
      return step;
    }
    backfilledCount++;
    return { ...step, decisionAt: block.startAt };
  });

  return { steps: patchedSteps, backfilledCount };
}
