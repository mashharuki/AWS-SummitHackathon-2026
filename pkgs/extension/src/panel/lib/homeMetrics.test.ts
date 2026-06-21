import { describe, expect, it } from "vitest";
import { computeHomeMetrics } from "./homeMetrics";
import type { CalendarStatus, Proposal } from "./types";

function at(h: number, m = 0): Date {
  return new Date(2026, 5, 20, h, m, 0, 0);
}

const emptyCalendar: CalendarStatus = { cached: false };

describe("computeHomeMetrics", () => {
  it("busyScore からカレンダー密度 % を算出する", () => {
    const m = computeHomeMetrics({
      now: at(10, 0),
      calendar: { cached: true, busyScore: 0.76 },
      proposal: null,
      pendingTaskCount: 0,
    });
    expect(m.calendarDensityPct).toBe(76);
  });

  it("freeSlotMinutesToday から密度を補完する", () => {
    const m = computeHomeMetrics({
      now: at(10, 0),
      calendar: { cached: true, freeSlotMinutesToday: 240 },
      proposal: null,
      pendingTaskCount: 0,
    });
    // used = 480-240 = 240 → 50%
    expect(m.calendarDensityPct).toBe(50);
  });

  it("データ欠損時もフォールバック値で全指標を返す", () => {
    const m = computeHomeMetrics({
      now: at(10, 0),
      calendar: emptyCalendar,
      proposal: null,
      pendingTaskCount: 0,
    });
    expect(m.calendarDensityPct).toBe(50);
    expect(m.cognitiveLoadScore).toBeGreaterThanOrEqual(0);
    expect(m.cognitiveLoadScore).toBeLessThanOrEqual(100);
    expect(typeof m.predictedEndTime).toBe("string");
  });

  it("psychSignals の externalPressureLevel=high で即レス圧が高くなる", () => {
    const proposal: Proposal = {
      taskId: "t1",
      verdict: "must_do",
      summaryText: "",
      reasoning: [],
      chatMessage: "",
      psychSignals: {
        externalPressureLevel: "high",
        nextMeetingPressure: "high",
        taskIdentifiability: "high",
      },
    };
    const m = computeHomeMetrics({
      now: at(10, 0),
      calendar: { cached: true, busyScore: 0.8 },
      proposal,
      pendingTaskCount: 2,
    });
    expect(m.responsePressurePct).toBeGreaterThan(70);
    expect(m.documentSharpness).toBe("high");
  });

  it("タスクが多いほど今日の余白が減る", () => {
    const few = computeHomeMetrics({
      now: at(9, 0),
      calendar: emptyCalendar,
      proposal: null,
      pendingTaskCount: 1,
    });
    const many = computeHomeMetrics({
      now: at(9, 0),
      calendar: emptyCalendar,
      proposal: null,
      pendingTaskCount: 8,
    });
    expect(many.saboruMinutesToday).toBeLessThan(few.saboruMinutesToday);
  });

  it("未処理タスクが残時間を超えると予測終了が 17:00 より後ろになる", () => {
    const m = computeHomeMetrics({
      now: at(16, 30),
      calendar: emptyCalendar,
      proposal: null,
      pendingTaskCount: 4, // 4*45=180分 ≫ 残 30分
    });
    // "HH:MM" を分に直して 17:00 より後か確認
    const [h, min] = m.predictedEndTime.split(":").map(Number);
    expect(h * 60 + min).toBeGreaterThan(17 * 60);
  });
});
