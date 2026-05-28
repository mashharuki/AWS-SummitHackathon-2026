import {
  blocksToPlannedSteps,
  hasOverlap,
  isEditableBand,
  moveDecisionBlock,
  moveWorkBlock,
  resizeWorkBlock,
} from "@/lib/ganttEdit";
import type { ScheduleBlock } from "@saboru/shared";
import { describe, expect, it } from "vitest";

const base = "2026-05-24T05:00:00.000Z";
const baseMs = new Date(base).getTime();
const iso = (min: number) => new Date(baseMs + min * 60_000).toISOString();

function block(over: Partial<ScheduleBlock>): ScheduleBlock {
  return {
    stepId: "s1",
    stepLabel: "作業",
    bandType: "work",
    startAt: iso(0),
    endAt: iso(30),
    durationMinutes: 30,
    ...over,
  };
}

describe("isEditableBand", () => {
  it("work / decision は編集可", () => {
    expect(isEditableBand("work")).toBe(true);
    expect(isEditableBand("decision")).toBe(true);
  });
  it("saboru / busy は編集不可", () => {
    expect(isEditableBand("saboru")).toBe(false);
    expect(isEditableBand("busy")).toBe(false);
  });
});

describe("blocksToPlannedSteps", () => {
  it("work/decision のみ抽出し、出現順を保つ", () => {
    const blocks: ScheduleBlock[] = [
      block({ stepId: "saboru_0", bandType: "saboru" }),
      block({ stepId: "s1", bandType: "work", durationMinutes: 30 }),
      block({ stepId: "busy_0", bandType: "busy" }),
      block({
        stepId: "s2",
        bandType: "decision",
        startAt: iso(60),
        endAt: iso(70),
        durationMinutes: 10,
      }),
    ];
    const steps = blocksToPlannedSteps(blocks);
    expect(steps.map((s) => s.stepId)).toEqual(["s1", "s2"]);
  });

  it("decision は startAt を decisionAt として持つ", () => {
    const steps = blocksToPlannedSteps([
      block({
        stepId: "s2",
        bandType: "decision",
        startAt: iso(120),
        endAt: iso(130),
        durationMinutes: 10,
      }),
    ]);
    expect(steps[0].decisionAt).toBe(iso(120));
  });

  it("work は decisionAt を持たず durationMinutes を反映する", () => {
    const steps = blocksToPlannedSteps([
      block({ stepId: "s1", bandType: "work", durationMinutes: 75 }),
    ]);
    expect(steps[0].decisionAt).toBeUndefined();
    expect(steps[0].durationMinutes).toBe(75);
  });

  it("rationale があれば引き継ぐ", () => {
    const steps = blocksToPlannedSteps([
      block({ stepId: "s1", bandType: "work", rationale: "理由あり" }),
    ]);
    expect(steps[0].rationale).toBe("理由あり");
  });

  it("originalBlocks なし: work は常に anchorAt を付与する", () => {
    const steps = blocksToPlannedSteps([
      block({
        stepId: "s1",
        bandType: "work",
        startAt: iso(60),
        endAt: iso(90),
      }),
    ]);
    expect(steps[0].anchorAt).toBe(iso(60));
  });

  it("originalBlocks あり: startAt が変化した work には anchorAt を付与する（移動済み）", () => {
    const original = [
      block({
        stepId: "s1",
        bandType: "work",
        startAt: iso(0),
        endAt: iso(30),
      }),
    ];
    const edited = [
      block({
        stepId: "s1",
        bandType: "work",
        startAt: iso(60),
        endAt: iso(90),
      }),
    ];
    const steps = blocksToPlannedSteps(edited, original);
    expect(steps[0].anchorAt).toBe(iso(60));
  });

  it("originalBlocks あり: startAt が変化していない work には anchorAt を付与しない（移動なし）", () => {
    const original = [
      block({
        stepId: "s1",
        bandType: "work",
        startAt: iso(0),
        endAt: iso(30),
      }),
    ];
    const same = [
      block({
        stepId: "s1",
        bandType: "work",
        startAt: iso(0),
        endAt: iso(30),
      }),
    ];
    const steps = blocksToPlannedSteps(same, original);
    expect(steps[0].anchorAt).toBeUndefined();
  });
});

describe("moveWorkBlock", () => {
  const work = block({ startAt: iso(0), endAt: iso(30), durationMinutes: 30 });

  it("開始を動かしても区間長は維持される", () => {
    const moved = moveWorkBlock(work, iso(60));
    expect(moved.startAt).toBe(iso(60));
    expect(moved.endAt).toBe(iso(90)); // 30分枠を維持
    expect(moved.durationMinutes).toBe(30);
  });

  it("他のフィールド（stepId, stepLabel 等）は変化しない", () => {
    const moved = moveWorkBlock(work, iso(120));
    expect(moved.stepId).toBe(work.stepId);
    expect(moved.stepLabel).toBe(work.stepLabel);
    expect(moved.bandType).toBe(work.bandType);
  });
});

describe("hasOverlap", () => {
  const work = block({ stepId: "s1", startAt: iso(0), endAt: iso(30) });

  it("時間が重なる busy があれば true", () => {
    const blocks = [
      work,
      block({
        stepId: "busy_0",
        bandType: "busy",
        startAt: iso(15),
        endAt: iso(45),
      }),
    ];
    expect(hasOverlap(work, blocks)).toBe(true);
  });

  it("重ならなければ false", () => {
    const blocks = [
      work,
      block({ stepId: "s2", startAt: iso(30), endAt: iso(60) }),
    ];
    expect(hasOverlap(work, blocks)).toBe(false);
  });

  it("saboru 帯とは重複扱いしない", () => {
    const blocks = [
      work,
      block({
        stepId: "saboru_0",
        bandType: "saboru",
        startAt: iso(0),
        endAt: iso(30),
      }),
    ];
    expect(hasOverlap(work, blocks)).toBe(false);
  });

  it("同一 stepId/startAt の別インスタンス（クローン）は自分自身として除外する", () => {
    // 参照は異なるが論理的に同一のブロック → 自己重複にしない
    const clone = block({ stepId: "s1", startAt: iso(0), endAt: iso(30) });
    const blocks = [block({ stepId: "s1", startAt: iso(0), endAt: iso(30) })];
    expect(hasOverlap(clone, blocks)).toBe(false);
  });
});

describe("moveDecisionBlock", () => {
  it("開始を動かしても区間長は維持される", () => {
    const d = block({
      stepId: "s2",
      bandType: "decision",
      startAt: iso(60),
      endAt: iso(70),
      durationMinutes: 10,
    });
    const moved = moveDecisionBlock(d, iso(90));
    expect(moved.startAt).toBe(iso(90));
    expect(moved.endAt).toBe(iso(100)); // 10分枠を維持
    expect(moved.durationMinutes).toBe(10);
  });
});

describe("resizeWorkBlock", () => {
  const work = block({ startAt: iso(0), endAt: iso(30), durationMinutes: 30 });

  it("右端リサイズ: 開始固定で終了が伸びる", () => {
    const r = resizeWorkBlock(work, "end", 60);
    expect(r.startAt).toBe(iso(0));
    expect(r.endAt).toBe(iso(60));
    expect(r.durationMinutes).toBe(60);
  });

  it("左端リサイズ: 終了固定で開始が巻き戻る", () => {
    const r = resizeWorkBlock(work, "start", 60);
    expect(r.endAt).toBe(iso(30));
    expect(r.startAt).toBe(iso(-30));
    expect(r.durationMinutes).toBe(60);
  });

  it("最小5分にクランプされる", () => {
    const r = resizeWorkBlock(work, "end", 1);
    expect(r.durationMinutes).toBe(5);
  });
});
