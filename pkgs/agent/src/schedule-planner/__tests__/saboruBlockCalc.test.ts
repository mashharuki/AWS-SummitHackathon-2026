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

/** decisionAt 付きの decision ステップ。 */
function decisionStep(id: string, decisionAt: string): ScheduleStep {
  return {
    stepId: id,
    stepLabel: `decision-${id}`,
    durationMinutes: 10,
    bandType: "decision",
    decisionAt,
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

describe("calcSchedule（後ろ詰め）", () => {
  it("作業は締切に後ろ詰めされ、手前がさぼろう帯になる", () => {
    const result = calcSchedule({
      steps: [step("s1", 30), step("s2", 30)],
      busySlots: [],
      now: NOW,
      deadline: at(180), // 3h 窓
    });
    const work = result.blocks.filter(
      (b) => b.bandType === "work" || b.bandType === "decision",
    );
    expect(work).toHaveLength(2);
    // 後ろ詰め: s2 が締切(180)に接して 150-180、s1 が 120-150
    const s1 = result.blocks.find((b) => b.stepId === "s1");
    const s2 = result.blocks.find((b) => b.stepId === "s2");
    expect(s2?.endAt).toBe(at(180));
    expect(s2?.startAt).toBe(at(150));
    expect(s1?.startAt).toBe(at(120));
    // 手前 0-120 が一つのさぼろう帯
    expect(result.totalSaboruMinutes).toBe(120);
    const firstBlock = result.blocks[0];
    expect(firstBlock.bandType).toBe("saboru");
    expect(new Date(firstBlock.startAt).getTime()).toBe(nowMs);
    expect(firstBlock.durationMinutes).toBe(120);
  });

  it("decision は decisionAt の時刻に固定され、手前の作業はそこへ後ろ詰めされる", () => {
    // 上司確認(decision)を 90 分後に固定。手前の作業 s1(30分) はその直前に。
    const result = calcSchedule({
      steps: [step("s1", 30), decisionStep("d1", at(90))],
      busySlots: [],
      now: NOW,
      deadline: at(180),
    });
    const d1 = result.blocks.find((b) => b.stepId === "d1");
    const s1 = result.blocks.find((b) => b.stepId === "s1");
    // decision は 90 分後に 10 分固定枠
    expect(d1?.startAt).toBe(at(90));
    expect(d1?.durationMinutes).toBe(10);
    expect(d1?.bandType).toBe("decision");
    // s1 は decision 開始(90)に後ろ詰め → 60-90
    expect(s1?.endAt).toBe(at(90));
    expect(s1?.startAt).toBe(at(60));
    // 0-60（s1手前）と 100-180（decision後〜締切）がさぼろう
    const saboru = result.blocks.filter((b) => b.bandType === "saboru");
    expect(saboru.length).toBe(2);
    expect(result.totalSaboruMinutes).toBe(60 + 80);
  });

  it("decision の後にも作業があれば、その作業は締切へ後ろ詰めされる", () => {
    // s1 → d1(90分) → s2。s2 は締切(180)へ後ろ詰め。
    const result = calcSchedule({
      steps: [step("s1", 30), decisionStep("d1", at(90)), step("s2", 30)],
      busySlots: [],
      now: NOW,
      deadline: at(180),
    });
    const s2 = result.blocks.find((b) => b.stepId === "s2");
    expect(s2?.endAt).toBe(at(180));
    expect(s2?.startAt).toBe(at(150));
    // decision(90-100) と s2(150-180) の間 100-150 はさぼろう
    const midSaboru = result.blocks.find(
      (b) =>
        b.bandType === "saboru" &&
        new Date(b.startAt).getTime() === nowMs + 100 * MIN,
    );
    expect(midSaboru?.durationMinutes).toBe(50);
  });

  it("busy 区間を避けて後ろ詰めする", () => {
    // 締切180。busy 150-180。s1(30分) は busy を避け 120-150 に。
    const result = calcSchedule({
      steps: [step("s1", 30)],
      busySlots: [{ startAt: at(150), endAt: at(180) }],
      now: NOW,
      deadline: at(180),
    });
    const s1 = result.blocks.find((b) => b.stepId === "s1");
    // 締切直前は busy なので、その手前 120-150 に置かれる
    expect(s1?.endAt).toBe(at(150));
    expect(s1?.startAt).toBe(at(120));
  });

  it("締切超過時は手前（過去側）へ押し出して配置する", () => {
    // 窓 30 分しかないが作業 60 分。後ろ詰めで s2 が 0-30、s1 が手前(-30-0)へはみ出す
    const result = calcSchedule({
      steps: [step("s1", 30), step("s2", 30)],
      busySlots: [],
      now: NOW,
      deadline: at(30),
    });
    const s1 = result.blocks.find((b) => b.stepId === "s1");
    const s2 = result.blocks.find((b) => b.stepId === "s2");
    expect(s2?.endAt).toBe(at(30));
    expect(s2?.startAt).toBe(at(0));
    // s1 は窓開始より手前へ押し出される
    expect(s1?.endAt).toBe(at(0));
    expect(s1?.startAt).toBe(at(-30));
    expect(result.totalSaboruMinutes).toBe(0);
  });

  it("締切 null でもフォールバック窓で後ろ詰め算出される", () => {
    const result = calcSchedule({
      steps: [step("s1", 30)],
      busySlots: [],
      now: NOW,
      deadline: null,
    });
    // 窓 8h - 作業 30 分 = 450 分さぼろう（手前にまとまる）
    expect(result.totalSaboruMinutes).toBe(450);
    const s1 = result.blocks.find((b) => b.stepId === "s1");
    // 窓終端 8h に後ろ詰め
    expect(s1?.endAt).toBe(at(480));
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

  it("作業が窓をちょうど使い切るとさぼろうは出ない", () => {
    const result = calcSchedule({
      steps: [step("s1", 60)],
      busySlots: [],
      now: NOW,
      deadline: at(60),
    });
    expect(result.totalSaboruMinutes).toBe(0);
    expect(result.blocks.every((b) => b.bandType !== "saboru")).toBe(true);
  });

  it("カレンダー予定を busy ブロックとして可視化する（title 付き）", () => {
    const result = calcSchedule({
      steps: [step("s1", 30)],
      busySlots: [{ startAt: at(60), endAt: at(90), title: "定例MTG" }],
      now: NOW,
      deadline: at(180),
    });
    const busy = result.blocks.find((b) => b.bandType === "busy");
    expect(busy).toBeDefined();
    expect(busy?.stepLabel).toBe("定例MTG");
    expect(busy?.startAt).toBe(at(60));
    expect(busy?.durationMinutes).toBe(30);
  });

  it("title 無しの予定は「予定」と表示する", () => {
    const result = calcSchedule({
      steps: [step("s1", 30)],
      busySlots: [{ startAt: at(60), endAt: at(90) }],
      now: NOW,
      deadline: at(180),
    });
    const busy = result.blocks.find((b) => b.bandType === "busy");
    expect(busy?.stepLabel).toBe("予定");
  });

  it("窓外の予定は busy ブロックにしない", () => {
    const result = calcSchedule({
      steps: [step("s1", 30)],
      busySlots: [{ startAt: at(300), endAt: at(360), title: "範囲外" }],
      now: NOW,
      deadline: at(120),
    });
    expect(result.blocks.some((b) => b.bandType === "busy")).toBe(false);
  });

  it("decisionAt の無い decision は work と同様に後ろ詰めされる（後方互換）", () => {
    // decisionAt を持たない decision は durationMinutes で配置される
    const result = calcSchedule({
      steps: [step("s1", 30), step("d_legacy", 30, "decision")],
      busySlots: [],
      now: NOW,
      deadline: at(180),
    });
    const dLegacy = result.blocks.find((b) => b.stepId === "d_legacy");
    // 締切に後ろ詰め（150-180）
    expect(dLegacy?.endAt).toBe(at(180));
    expect(dLegacy?.bandType).toBe("decision");
    expect(result.totalSaboruMinutes).toBe(120);
  });
});
