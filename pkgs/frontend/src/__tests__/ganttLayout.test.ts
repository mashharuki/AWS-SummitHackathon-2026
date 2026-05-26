import {
  BAND_META,
  buildDummySchedule,
  buildRows,
  buildTimeTicks,
  durationToWidthPx,
  filterScheduleByDay,
  formatTick,
  getDayRange,
  isSameLocalDay,
  timeToPx,
  viewWidthPx,
} from "@/lib/ganttLayout";
import type { SaboriSchedule, ScheduleBlock } from "@saboru/shared";
import { describe, expect, it } from "vitest";

const VIEW_START = "2026-05-24T05:00:00.000Z";
const VIEW_END = "2026-05-24T08:00:00.000Z"; // 3h
const viewStartMs = new Date(VIEW_START).getTime();

function block(
  stepId: string,
  bandType: ScheduleBlock["bandType"],
  startMin: number,
  durationMinutes: number,
  stepLabel = `step-${stepId}`,
): ScheduleBlock {
  const startMs = viewStartMs + startMin * 60_000;
  return {
    stepId,
    stepLabel,
    bandType,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(startMs + durationMinutes * 60_000).toISOString(),
    durationMinutes,
  };
}

describe("BAND_META", () => {
  it("4 バンド種別すべてにメタがある", () => {
    expect(BAND_META.saboru.label).toBe("さぼろう");
    expect(BAND_META.work.label).toBe("作業");
    expect(BAND_META.decision.label).toBe("意思決定");
    expect(BAND_META.busy.label).toBe("予定");
  });
});

describe("timeToPx", () => {
  it("ビュー開始は 0px", () => {
    expect(timeToPx(VIEW_START, viewStartMs, 120)).toBe(0);
  });
  it("1時間後は pxPerHour 分", () => {
    const oneHour = new Date(viewStartMs + 60 * 60_000).toISOString();
    expect(timeToPx(oneHour, viewStartMs, 120)).toBe(120);
  });
});

describe("durationToWidthPx", () => {
  it("60分 = pxPerHour", () => {
    expect(durationToWidthPx(60, 120)).toBe(120);
  });
  it("最小幅 8px を保証する", () => {
    expect(durationToWidthPx(1, 120)).toBe(8);
  });
});

describe("formatTick", () => {
  it("HH:MM 形式（ゼロ埋め）", () => {
    const d = new Date("2026-05-24T03:05:00.000Z");
    // ローカルタイム依存だが HH:MM 形式であることを確認
    expect(formatTick(d)).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("buildTimeTicks", () => {
  it("30分刻みの目盛りを生成する", () => {
    const ticks = buildTimeTicks(VIEW_START, VIEW_END, 120, 30);
    expect(ticks.length).toBeGreaterThan(0);
    // leftPx は単調増加
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].leftPx).toBeGreaterThan(ticks[i - 1].leftPx);
    }
  });

  it("端数開始でも区切りに丸める", () => {
    // 05:10 開始 → 最初の目盛りは 05:30
    const ticks = buildTimeTicks("2026-05-24T05:10:00.000Z", VIEW_END, 120, 30);
    expect(ticks[0].leftPx).toBeGreaterThan(0);
  });
});

describe("viewWidthPx", () => {
  it("3時間 × 120px = 360px", () => {
    expect(viewWidthPx(VIEW_START, VIEW_END, 120)).toBe(360);
  });
});

describe("buildDummySchedule", () => {
  it("さぼろう/作業/意思決定を含むサンプル盤面を生成する", () => {
    const s = buildDummySchedule("demo", new Date(VIEW_START));
    expect(s.taskId).toBe("demo");
    expect(s.calendarUsed).toBe(false);
    expect(s.totalSaboruMinutes).toBe(90);
    const bands = new Set(s.blocks.map((b) => b.bandType));
    expect(bands.has("saboru")).toBe(true);
    expect(bands.has("work")).toBe(true);
    expect(bands.has("decision")).toBe(true);
  });

  it("now 省略時もブロックを生成する", () => {
    const s = buildDummySchedule("demo");
    expect(s.blocks.length).toBeGreaterThan(0);
  });
});

describe("buildRows", () => {
  function makeSchedule(blocks: ScheduleBlock[]): SaboriSchedule {
    return {
      taskId: "t1",
      generatedAt: VIEW_START,
      viewStartAt: VIEW_START,
      viewEndAt: VIEW_END,
      deadline: VIEW_END,
      blocks,
      totalSaboruMinutes: 60,
      calendarUsed: false,
    };
  }

  it("さぼろう行を最上段に配置する", () => {
    const rows = buildRows(
      makeSchedule([
        block("s1", "work", 0, 30, "作業A"),
        block("saboru_0", "saboru", 30, 60),
      ]),
    );
    expect(rows[0].bandType).toBe("saboru");
    expect(rows[0].stepLabel).toBe("さぼろう");
  });

  it("さぼろうブロックが無くても、さぼろう行を常にトップに置く（空レーン）", () => {
    const rows = buildRows(makeSchedule([block("s1", "work", 0, 30, "作業A")]));
    expect(rows[0].bandType).toBe("saboru");
    expect(rows[0].stepLabel).toBe("さぼろう");
    expect(rows[0].blocks).toHaveLength(0);
    // さぼろう行 + 作業A行
    expect(rows).toHaveLength(2);
  });

  it("複数さぼろうブロックを1行に集約する", () => {
    const rows = buildRows(
      makeSchedule([
        block("saboru_0", "saboru", 0, 30),
        block("saboru_1", "saboru", 60, 30),
        block("s1", "work", 30, 30, "作業A"),
      ]),
    );
    const saboruRow = rows.find((r) => r.bandType === "saboru");
    expect(saboruRow?.blocks).toHaveLength(2);
  });

  it("同一 stepId のブロックを1行に集約する", () => {
    const rows = buildRows(
      makeSchedule([
        block("s1", "work", 0, 30, "作業A"),
        block("s1", "work", 60, 30, "作業A"), // スロットまたぎ
        block("s2", "decision", 90, 30, "確認"),
      ]),
    );
    const a = rows.find((r) => r.stepLabel === "作業A");
    expect(a?.blocks).toHaveLength(2);
    const d = rows.find((r) => r.stepLabel === "確認");
    expect(d?.blocks).toHaveLength(1);
    expect(d?.bandType).toBe("decision");
  });

  it("複数の busy（予定）を「予定」1行に集約する（縦肥大の防止）", () => {
    const rows = buildRows(
      makeSchedule([
        block("ev1", "busy", 0, 60, "ジム"),
        block("ev2", "busy", 90, 30, "zkTokyo"),
        block("ev3", "busy", 130, 30, "JPYC定例"),
        block("s1", "work", 60, 30, "作業A"),
      ]),
    );
    const busyRows = rows.filter((r) => r.bandType === "busy");
    expect(busyRows).toHaveLength(1);
    expect(busyRows[0].stepLabel).toBe("予定");
    expect(busyRows[0].blocks).toHaveLength(3);
    // 個々の予定名はブロックに保持される
    expect(busyRows[0].blocks.map((b) => b.stepLabel)).toEqual([
      "ジム",
      "zkTokyo",
      "JPYC定例",
    ]);
  });

  it("busy が無ければ予定行を作らない", () => {
    const rows = buildRows(makeSchedule([block("s1", "work", 0, 30, "作業A")]));
    expect(rows.some((r) => r.bandType === "busy")).toBe(false);
  });

  it("busy 行は作業行の後（最下段）に配置する", () => {
    const rows = buildRows(
      makeSchedule([
        block("saboru_0", "saboru", 0, 30),
        block("s1", "work", 30, 30, "作業A"),
        block("ev1", "busy", 60, 30, "ジム"),
      ]),
    );
    expect(rows[rows.length - 1].bandType).toBe("busy");
  });
});

describe("isSameLocalDay", () => {
  it("同じローカル日付なら true", () => {
    const a = new Date(2026, 4, 26, 9, 0);
    const b = new Date(2026, 4, 26, 23, 0);
    expect(isSameLocalDay(a, b)).toBe(true);
  });
  it("別日なら false", () => {
    const a = new Date(2026, 4, 26, 23, 59);
    const b = new Date(2026, 4, 27, 0, 1);
    expect(isSameLocalDay(a, b)).toBe(false);
  });
});

describe("getDayRange", () => {
  // ローカルタイムで日付を組み立てる（タイムゾーン非依存にするため）
  function localSchedule(
    viewStart: Date,
    viewEnd: Date,
    deadline: Date | null,
  ): SaboriSchedule {
    return {
      taskId: "t1",
      generatedAt: viewStart.toISOString(),
      viewStartAt: viewStart.toISOString(),
      viewEndAt: viewEnd.toISOString(),
      deadline: deadline ? deadline.toISOString() : null,
      blocks: [],
      totalSaboruMinutes: 0,
      calendarUsed: false,
    };
  }

  it("今日が対象日なら開始は now、終了は締切（その日中）", () => {
    const now = new Date(2026, 4, 26, 14, 0); // 今日 14:00
    const deadline = new Date(2026, 4, 26, 18, 0); // 今日 18:00
    const viewEnd = new Date(2026, 4, 30, 23, 59); // 締切より後ろまでビューは伸びている
    const s = localSchedule(now, viewEnd, deadline);

    const range = getDayRange(now, s, now);
    expect(new Date(range.startAt).getTime()).toBe(now.getTime());
    // 夜まで伸ばさず締切まで
    expect(new Date(range.endAt).getTime()).toBe(deadline.getTime());
  });

  it("締切が翌日以降なら、当日の終了はその日の 23:59:59.999", () => {
    const now = new Date(2026, 4, 26, 9, 0);
    const deadline = new Date(2026, 4, 28, 18, 0); // 締切は2日後
    const viewEnd = new Date(2026, 4, 28, 18, 0);
    const s = localSchedule(now, viewEnd, deadline);

    const range = getDayRange(now, s, now);
    const end = new Date(range.endAt);
    expect(isSameLocalDay(end, now)).toBe(true);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it("翌日を指定した場合は開始 00:00・終了 23:59（その日が締切日でなければ）", () => {
    const now = new Date(2026, 4, 26, 9, 0);
    const tomorrow = new Date(2026, 4, 27, 0, 0);
    const deadline = new Date(2026, 4, 28, 18, 0);
    const viewEnd = new Date(2026, 4, 28, 18, 0);
    const s = localSchedule(now, viewEnd, deadline);

    const range = getDayRange(tomorrow, s, now);
    const start = new Date(range.startAt);
    const end = new Date(range.endAt);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(isSameLocalDay(end, tomorrow)).toBe(true);
  });

  it("開始が終了以上の異常時は最低1時間の窓を確保する", () => {
    const now = new Date(2026, 4, 26, 23, 59);
    const deadline = new Date(2026, 4, 26, 23, 59, 30); // ほぼ now と同時
    const s = localSchedule(now, deadline, deadline);
    const range = getDayRange(now, s, now);
    expect(new Date(range.endAt).getTime()).toBeGreaterThan(
      new Date(range.startAt).getTime(),
    );
  });
});

describe("filterScheduleByDay", () => {
  function bl(
    stepId: string,
    bandType: ScheduleBlock["bandType"],
    start: Date,
    durationMinutes: number,
    stepLabel = stepId,
  ): ScheduleBlock {
    return {
      stepId,
      stepLabel,
      bandType,
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + durationMinutes * 60_000).toISOString(),
      durationMinutes,
    };
  }

  it("当日範囲外のブロックを除外し、当日のものだけ残す", () => {
    const now = new Date(2026, 4, 26, 9, 0);
    const todayBlock = bl("today", "work", new Date(2026, 4, 26, 10, 0), 60);
    const tomorrowBlock = bl(
      "tomorrow",
      "work",
      new Date(2026, 4, 27, 10, 0),
      60,
    );
    const schedule: SaboriSchedule = {
      taskId: "t1",
      generatedAt: now.toISOString(),
      viewStartAt: now.toISOString(),
      viewEndAt: new Date(2026, 4, 28, 0, 0).toISOString(),
      deadline: new Date(2026, 4, 28, 0, 0).toISOString(),
      blocks: [todayBlock, tomorrowBlock],
      totalSaboruMinutes: 0,
      calendarUsed: false,
    };

    const filtered = filterScheduleByDay(schedule, now, now);
    expect(filtered.blocks).toHaveLength(1);
    expect(filtered.blocks[0].stepId).toBe("today");
  });

  it("締切が当日でなければ deadline を null にする（締切ラインを当日に出さない）", () => {
    const now = new Date(2026, 4, 26, 9, 0);
    const schedule: SaboriSchedule = {
      taskId: "t1",
      generatedAt: now.toISOString(),
      viewStartAt: now.toISOString(),
      viewEndAt: new Date(2026, 4, 28, 0, 0).toISOString(),
      deadline: new Date(2026, 4, 28, 18, 0).toISOString(),
      blocks: [],
      totalSaboruMinutes: 0,
      calendarUsed: false,
    };
    const filtered = filterScheduleByDay(schedule, now, now);
    expect(filtered.deadline).toBeNull();
  });

  it("totalSaboruMinutes を当日の saboru ブロック合計で再計算する", () => {
    const now = new Date(2026, 4, 26, 9, 0);
    const schedule: SaboriSchedule = {
      taskId: "t1",
      generatedAt: now.toISOString(),
      viewStartAt: now.toISOString(),
      viewEndAt: new Date(2026, 4, 28, 0, 0).toISOString(),
      deadline: new Date(2026, 4, 28, 0, 0).toISOString(),
      blocks: [
        bl("sab1", "saboru", new Date(2026, 4, 26, 10, 0), 30),
        bl("sab2", "saboru", new Date(2026, 4, 27, 10, 0), 45), // 翌日（除外）
      ],
      totalSaboruMinutes: 75,
      calendarUsed: false,
    };
    const filtered = filterScheduleByDay(schedule, now, now);
    expect(filtered.totalSaboruMinutes).toBe(30);
  });
});
