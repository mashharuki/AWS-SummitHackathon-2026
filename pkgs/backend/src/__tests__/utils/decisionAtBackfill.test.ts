/**
 * backfillDecisionAt のユニットテスト
 *
 * - decisionAt あり → そのまま（変更なし）
 * - decisionAt なし → calcSchedule の後ろ詰め配置時刻で補完
 * - 複数 decision の順序保持
 * - work ステップは変更されない
 * - 元配列を破壊しない
 */

import type { ScheduleStep } from "@saboru/shared";
import { describe, expect, it } from "vitest";
import { backfillDecisionAt } from "../../utils/decisionAtBackfill.js";

const NOW = "2026-05-28T05:00:00.000Z"; // UTC 05:00 = JST 14:00
const DEADLINE = "2026-05-28T09:00:00.000Z"; // UTC 09:00 = JST 18:00（4h後）

function makeWork(id: string, durationMinutes: number): ScheduleStep {
  return {
    stepId: id,
    stepLabel: `作業 ${id}`,
    durationMinutes,
    bandType: "work",
  };
}

function makeDecision(
  id: string,
  durationMinutes: number,
  decisionAt?: string,
): ScheduleStep {
  const step: ScheduleStep = {
    stepId: id,
    stepLabel: `確認 ${id}`,
    durationMinutes,
    bandType: "decision",
  };
  if (decisionAt !== undefined) {
    step.decisionAt = decisionAt;
  }
  return step;
}

describe("backfillDecisionAt", () => {
  it("decisionAt が全て揃っている場合は変更なし (backfilledCount=0)", () => {
    const steps: ScheduleStep[] = [
      makeWork("s1", 60),
      makeDecision("d1", 10, "2026-05-28T08:00:00.000Z"),
    ];
    const { steps: result, backfilledCount } = backfillDecisionAt(
      steps,
      NOW,
      DEADLINE,
    );
    expect(backfilledCount).toBe(0);
    // 同じ参照を返す（補完不要時）
    expect(result).toBe(steps);
  });

  it("decisionAt が欠けている decision を補完する", () => {
    const steps: ScheduleStep[] = [
      makeWork("s1", 60),
      makeDecision("d1", 10), // decisionAt なし
    ];
    const { steps: result, backfilledCount } = backfillDecisionAt(
      steps,
      NOW,
      DEADLINE,
    );
    expect(backfilledCount).toBe(1);
    // d1 に decisionAt が付いている
    const d1 = result.find((s) => s.stepId === "d1");
    expect(d1?.decisionAt).toBeDefined();
    // 補完された時刻は ISO 8601 形式
    expect(d1?.decisionAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("decisionAt がある decision はそのままで、ない decision だけ補完する", () => {
    const FIXED_AT = "2026-05-28T07:30:00.000Z";
    const steps: ScheduleStep[] = [
      makeWork("s1", 30),
      makeDecision("d1", 10, FIXED_AT), // 既存の decisionAt を保持
      makeWork("s2", 30),
      makeDecision("d2", 10), // こちらを補完
    ];
    const { steps: result, backfilledCount } = backfillDecisionAt(
      steps,
      NOW,
      DEADLINE,
    );
    expect(backfilledCount).toBe(1);
    // d1 は変更されない
    const d1 = result.find((s) => s.stepId === "d1");
    expect(d1?.decisionAt).toBe(FIXED_AT);
    // d2 は補完される
    const d2 = result.find((s) => s.stepId === "d2");
    expect(d2?.decisionAt).toBeDefined();
  });

  it("複数 decision が全て欠落していても順序を維持して補完する", () => {
    const steps: ScheduleStep[] = [
      makeWork("s1", 30),
      makeDecision("d1", 10), // 補完対象
      makeWork("s2", 20),
      makeDecision("d2", 10), // 補完対象
    ];
    const { steps: result, backfilledCount } = backfillDecisionAt(
      steps,
      NOW,
      DEADLINE,
    );
    expect(backfilledCount).toBe(2);
    // 元の配列長と同じ
    expect(result).toHaveLength(steps.length);
    // ステップの順序が維持されている
    expect(result.map((s) => s.stepId)).toEqual(["s1", "d1", "s2", "d2"]);
    // 両 decision に decisionAt がある
    const d1 = result.find((s) => s.stepId === "d1");
    const d2 = result.find((s) => s.stepId === "d2");
    expect(d1?.decisionAt).toBeDefined();
    expect(d2?.decisionAt).toBeDefined();
  });

  it("work ステップは変更されない", () => {
    const steps: ScheduleStep[] = [
      makeWork("s1", 60),
      makeDecision("d1", 10), // 補完対象
    ];
    const { steps: result } = backfillDecisionAt(steps, NOW, DEADLINE);
    const s1 = result.find((s) => s.stepId === "s1");
    // work には decisionAt が付かない
    expect(s1?.decisionAt).toBeUndefined();
    // bandType / stepLabel は変わらない
    expect(s1?.bandType).toBe("work");
    expect(s1?.stepLabel).toBe("作業 s1");
  });

  it("元配列を破壊しない（イミュータブル）", () => {
    const steps: ScheduleStep[] = [makeWork("s1", 60), makeDecision("d1", 10)];
    const origDecisionAt = steps[1]?.decisionAt;
    backfillDecisionAt(steps, NOW, DEADLINE);
    // 元の配列の要素は変わっていない
    expect(steps[1]?.decisionAt).toBe(origDecisionAt);
  });

  it("deadline=null でも補完できる（締切なし時は窓終端を自動決定）", () => {
    const steps: ScheduleStep[] = [makeWork("s1", 30), makeDecision("d1", 10)];
    const { steps: result, backfilledCount } = backfillDecisionAt(
      steps,
      NOW,
      null, // 締切なし
    );
    expect(backfilledCount).toBe(1);
    const d1 = result.find((s) => s.stepId === "d1");
    expect(d1?.decisionAt).toBeDefined();
  });

  it("decision ステップのみで work がないケースでも補完する", () => {
    const steps: ScheduleStep[] = [
      makeDecision("d1", 10), // decisionAt なし
    ];
    const { steps: result, backfilledCount } = backfillDecisionAt(
      steps,
      NOW,
      DEADLINE,
    );
    expect(backfilledCount).toBe(1);
    const d1 = result.find((s) => s.stepId === "d1");
    expect(d1?.decisionAt).toBeDefined();
  });
});
