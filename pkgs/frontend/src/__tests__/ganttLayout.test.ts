import {
  BAND_META,
  buildDummySchedule,
  buildRows,
  buildTimeTicks,
  durationToWidthPx,
  formatTick,
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
  it("3 バンド種別すべてにメタがある", () => {
    expect(BAND_META.saboru.label).toBe("さぼろう");
    expect(BAND_META.work.label).toBe("作業");
    expect(BAND_META.decision.label).toBe("意思決定");
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

  it("さぼろうブロックが無ければさぼろう行を作らない", () => {
    const rows = buildRows(makeSchedule([block("s1", "work", 0, 30, "作業A")]));
    expect(rows.every((r) => r.bandType !== "saboru")).toBe(true);
    expect(rows).toHaveLength(1);
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
});
