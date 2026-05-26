import type { BusySlot } from "@saboru/shared";
import { describe, expect, it } from "vitest";
import {
  buildAvailableSlots,
  calcSchedule,
  normalizeBusySlots,
  resolveWindowEnd,
} from "../saboruBlockCalc.js";
import type { ScheduleStep } from "../tools.js";

const MIN = 60_000;
// 基準時刻: 2026-05-24T05:00:00.000Z
const NOW = "2026-05-24T05:00:00.000Z";
const nowMs = new Date(NOW).getTime();
const at = (offsetMin: number): string =>
  new Date(nowMs + offsetMin * MIN).toISOString();

function step(
  id: string,
  durationMinutes: number,
  bandType: "work" | "decision" = "work",
  rationale?: string,
): ScheduleStep {
  return {
    stepId: id,
    stepLabel: `step-${id}`,
    durationMinutes,
    bandType,
    rationale,
  };
}

describe("normalizeBusySlots", () => {
  it("窓外を切り落とし、時刻順にソートする", () => {
    const busy: BusySlot[] = [
      { startAt: at(60), endAt: at(90) },
      { startAt: at(-30), endAt: at(10) }, // 窓開始前にまたがる
    ];
    const result = normalizeBusySlots(busy, nowMs, nowMs + 120 * MIN);
    expect(result).toHaveLength(2);
    // ソート済み: 最初は at(0)〜at(10)
    expect(result[0].start).toBe(nowMs);
    expect(result[0].end).toBe(nowMs + 10 * MIN);
    expect(result[1].start).toBe(nowMs + 60 * MIN);
  });

  it("重複・隣接区間をマージする", () => {
    const busy: BusySlot[] = [
      { startAt: at(10), endAt: at(30) },
      { startAt: at(25), endAt: at(50) }, // 重複
      { startAt: at(50), endAt: at(60) }, // 隣接
    ];
    const result = normalizeBusySlots(busy, nowMs, nowMs + 120 * MIN);
    expect(result).toHaveLength(1);
    expect(result[0].start).toBe(nowMs + 10 * MIN);
    expect(result[0].end).toBe(nowMs + 60 * MIN);
  });

  it("窓外で完全に潰れる区間は除外する", () => {
    const busy: BusySlot[] = [{ startAt: at(200), endAt: at(300) }];
    const result = normalizeBusySlots(busy, nowMs, nowMs + 120 * MIN);
    expect(result).toHaveLength(0);
  });
});

describe("buildAvailableSlots", () => {
  it("busy なしなら窓全体が利用可能", () => {
    const result = buildAvailableSlots(nowMs, nowMs + 60 * MIN, []);
    expect(result).toEqual([{ start: nowMs, end: nowMs + 60 * MIN }]);
  });

  it("中央に busy があると前後に分割される", () => {
    const busy = [{ start: nowMs + 20 * MIN, end: nowMs + 40 * MIN }];
    const result = buildAvailableSlots(nowMs, nowMs + 60 * MIN, busy);
    expect(result).toEqual([
      { start: nowMs, end: nowMs + 20 * MIN },
      { start: nowMs + 40 * MIN, end: nowMs + 60 * MIN },
    ]);
  });

  it("窓先頭から busy が始まると先頭スロットは作られない", () => {
    const busy = [{ start: nowMs, end: nowMs + 20 * MIN }];
    const result = buildAvailableSlots(nowMs, nowMs + 60 * MIN, busy);
    expect(result).toEqual([
      { start: nowMs + 20 * MIN, end: nowMs + 60 * MIN },
    ]);
  });

  it("窓末尾まで busy だと末尾スロットは作られない", () => {
    const busy = [{ start: nowMs + 40 * MIN, end: nowMs + 60 * MIN }];
    const result = buildAvailableSlots(nowMs, nowMs + 60 * MIN, busy);
    expect(result).toEqual([{ start: nowMs, end: nowMs + 40 * MIN }]);
  });
});

describe("resolveWindowEnd", () => {
  it("締切ありはその時刻", () => {
    expect(resolveWindowEnd(nowMs, at(120), 30)).toBe(nowMs + 120 * MIN);
  });

  it("締切が現在以前なら作業合計ぶん確保", () => {
    expect(resolveWindowEnd(nowMs, at(-10), 45)).toBe(nowMs + 45 * MIN);
  });

  it("締切なしは now + 作業 + 4h（最低 8h）", () => {
    // 作業 60 分 → 60+240=300 分 < 480 分(8h) なので 8h
    expect(resolveWindowEnd(nowMs, null, 60)).toBe(nowMs + 480 * MIN);
    // 作業 300 分 → 300+240=540 分 > 480 分 なので 540 分
    expect(resolveWindowEnd(nowMs, null, 300)).toBe(nowMs + 540 * MIN);
  });
});

describe("calcSchedule", () => {
  it("busy なし: ステップ配置後の余白がさぼろう帯になる", () => {
    const result = calcSchedule({
      steps: [step("s1", 30), step("s2", 30, "decision")],
      busySlots: [],
      now: NOW,
      deadline: at(180), // 3h 窓
    });
    const work = result.blocks.filter((b) => b.bandType !== "saboru");
    const saboru = result.blocks.filter((b) => b.bandType === "saboru");
    expect(work).toHaveLength(2);
    // 窓 180 分 - 作業 60 分 = 120 分のさぼろう
    expect(result.totalSaboruMinutes).toBe(120);
    expect(saboru.length).toBeGreaterThanOrEqual(1);
    // 時系列ソート確認
    expect(new Date(result.blocks[0].startAt).getTime()).toBe(nowMs);
  });

  it("busy 区間はさぼろうにせず避けて配置する", () => {
    // 0-30 に busy。s1(30分) は 30 以降に配置される
    const result = calcSchedule({
      steps: [step("s1", 30)],
      busySlots: [{ startAt: at(0), endAt: at(30) }],
      now: NOW,
      deadline: at(120),
    });
    const s1 = result.blocks.find((b) => b.stepId === "s1");
    // s1 は busy 後（at(30)）から始まる
    expect(s1?.startAt).toBe(at(30));
  });

  it("スロットに収まらないステップは次スロットへ持ち越す", () => {
    // 利用可能: 0-20, 50-120（20-50がbusy）。s1=30分 は最初のスロット(20分)に入らず次へ
    const result = calcSchedule({
      steps: [step("s1", 30)],
      busySlots: [{ startAt: at(20), endAt: at(50) }],
      now: NOW,
      deadline: at(120),
    });
    const s1 = result.blocks.find((b) => b.stepId === "s1");
    expect(s1?.startAt).toBe(at(50));
    // 最初のスロット 0-20 はさぼろう帯
    const firstSaboru = result.blocks.find(
      (b) => b.bandType === "saboru" && new Date(b.startAt).getTime() === nowMs,
    );
    expect(firstSaboru?.durationMinutes).toBe(20);
  });

  it("空きが尽きたステップは窓末尾以降に押し込む（締切超過）", () => {
    // 窓 30 分しかないが作業 60 分。s2 ははみ出す
    const result = calcSchedule({
      steps: [step("s1", 30), step("s2", 30)],
      busySlots: [],
      now: NOW,
      deadline: at(30),
    });
    const s2 = result.blocks.find((b) => b.stepId === "s2");
    // s1 が 0-30 を埋め、s2 は窓末尾(30分)から
    expect(s2?.startAt).toBe(at(30));
    expect(result.totalSaboruMinutes).toBe(0);
  });

  it("締切 null でもフォールバック窓で算出される", () => {
    const result = calcSchedule({
      steps: [step("s1", 30)],
      busySlots: [],
      now: NOW,
      deadline: null,
    });
    // 窓 8h - 作業 30 分 = 450 分さぼろう
    expect(result.totalSaboruMinutes).toBe(450);
  });

  it("rationale 付きステップは rationale を保持する", () => {
    const result = calcSchedule({
      steps: [step("s1", 30, "work", "理由テキスト"), step("s2", 30)],
      busySlots: [],
      now: NOW,
      deadline: at(120),
    });
    const s1 = result.blocks.find((b) => b.stepId === "s1");
    expect(s1?.rationale).toBe("理由テキスト");
    const s2 = result.blocks.find((b) => b.stepId === "s2");
    expect(s2?.rationale).toBeUndefined();
  });

  it("ステップがスロットをちょうど使い切ると末尾さぼろうは出ない", () => {
    const result = calcSchedule({
      steps: [step("s1", 60)],
      busySlots: [],
      now: NOW,
      deadline: at(60),
    });
    expect(result.totalSaboruMinutes).toBe(0);
    expect(result.blocks.every((b) => b.bandType !== "saboru")).toBe(true);
  });
});
