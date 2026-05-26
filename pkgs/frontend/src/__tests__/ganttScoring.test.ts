import {
  calcGanttAugmentedGrade,
  calcGanttGameScore,
  calcGanttGrade,
  extractGanttResult,
  qualityMultiplier,
} from "@/lib/ganttScoringUtils";
import type { SaboriSchedule } from "@saboru/shared";
import { describe, expect, it } from "vitest";

describe("qualityMultiplier", () => {
  it.each([
    [3, 1.5],
    [4, 1.5],
    [2, 1.2],
    [1, 1.0],
    [0, 0.5],
  ])("reasoning %i 件 → %f", (count, expected) => {
    expect(qualityMultiplier(count)).toBe(expected);
  });
});

describe("calcGanttGameScore", () => {
  it("時間 × 品質 × コンボ", () => {
    // 60分 × 1.5(根拠3) × 1.0(コンボ0) = 90
    expect(calcGanttGameScore(60, 3, 0)).toBe(90);
  });
  it("コンボ乗数が掛かる", () => {
    // 60 × 1.5 × 2.0(コンボ5) = 180
    expect(calcGanttGameScore(60, 3, 5)).toBe(180);
  });
  it("根拠ゼロは 0.5 倍", () => {
    // 60 × 0.5 × 1.0 = 30
    expect(calcGanttGameScore(60, 0, 0)).toBe(30);
  });
});

describe("calcGanttGrade", () => {
  it("S: 60分以上 + 高品質", () => {
    expect(calcGanttGrade(60, 3).grade).toBe("S");
    expect(calcGanttGrade(60, 3).intensity).toBe("jackpot");
  });
  it("A: 45分以上 + 品質1.2以上", () => {
    expect(calcGanttGrade(45, 2).grade).toBe("A");
  });
  it("B: 30分以上", () => {
    expect(calcGanttGrade(30, 1).grade).toBe("B");
  });
  it("C: 15分以上", () => {
    expect(calcGanttGrade(15, 1).grade).toBe("C");
  });
  it("D: それ未満", () => {
    expect(calcGanttGrade(5, 1).grade).toBe("D");
    expect(calcGanttGrade(5, 1).intensity).toBe("none");
  });
  it("60分でも低品質なら S にならない", () => {
    // quality 1.0 → S 条件(quality>=1.5)外、45分以上だが quality<1.2 → B
    expect(calcGanttGrade(60, 1).grade).toBe("B");
  });
});

describe("calcGanttAugmentedGrade", () => {
  it("ガント無し（ganttGameScore 未指定）は既存挙動と同じ", () => {
    // can_saboru + signalCount 3 → A（既存ロジック）
    expect(
      calcGanttAugmentedGrade({ verdict: "can_saboru", signalCount: 3 }),
    ).toBe("A");
  });

  it("ガントスコアで signalCount にボーナス加算される", () => {
    // signalCount 1 + ganttGameScore 90(→+3) = 4 → A 相当に上振れ
    const grade = calcGanttAugmentedGrade({
      verdict: "can_saboru",
      signalCount: 1,
      ganttGameScore: 90,
    });
    expect(grade).toBe("A");
  });

  it("must_do は常に E（ガントスコアがあっても）", () => {
    expect(
      calcGanttAugmentedGrade({ verdict: "must_do", ganttGameScore: 300 }),
    ).toBe("E");
  });

  it("デフォルト引数（signalCount/dependencyScore/isComboActive 省略）", () => {
    // can_saboru で signalCount 不明 → B（既存ロジックのデフォルト）
    expect(calcGanttAugmentedGrade({ verdict: "can_saboru" })).toBe("B");
  });
});

describe("extractGanttResult", () => {
  const schedule: SaboriSchedule = {
    taskId: "t1",
    generatedAt: "2026-05-24T05:00:00.000Z",
    viewStartAt: "2026-05-24T05:00:00.000Z",
    viewEndAt: "2026-05-24T08:00:00.000Z",
    deadline: "2026-05-24T08:00:00.000Z",
    blocks: [],
    totalSaboruMinutes: 60,
    calendarUsed: false,
  };

  it("スケジュールからスコア・時間・グレードを抽出する", () => {
    const result = extractGanttResult(schedule, 3, 0);
    expect(result.totalSaboruMinutes).toBe(60);
    expect(result.ganttGameScore).toBe(90); // 60×1.5×1.0
    expect(result.grade.grade).toBe("S");
  });
});
