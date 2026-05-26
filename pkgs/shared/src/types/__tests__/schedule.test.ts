import { describe, expect, it } from "vitest";
import {
  BandTypeSchema,
  BusySlotSchema,
  SaboriScheduleSchema,
  ScheduleApiResponseSchema,
  ScheduleBlockSchema,
  ScheduleStepSchema,
} from "../schedule";

const ISO = "2026-05-24T15:00:00.000Z";
const ISO2 = "2026-05-24T15:30:00.000Z";

describe("BandTypeSchema", () => {
  it.each(["saboru", "work", "decision", "busy"])("accepts %s", (v) => {
    expect(BandTypeSchema.safeParse(v).success).toBe(true);
  });

  it("rejects unknown band type", () => {
    expect(BandTypeSchema.safeParse("rest").success).toBe(false);
  });
});

describe("BusySlotSchema", () => {
  it("accepts valid slot", () => {
    const result = BusySlotSchema.safeParse({ startAt: ISO, endAt: ISO2 });
    expect(result.success).toBe(true);
  });

  it("accepts slot with title", () => {
    const result = BusySlotSchema.safeParse({
      startAt: ISO,
      endAt: ISO2,
      title: "定例MTG",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-ISO datetime", () => {
    expect(
      BusySlotSchema.safeParse({ startAt: "2026-05-24", endAt: ISO2 }).success,
    ).toBe(false);
  });

  it("rejects missing endAt", () => {
    expect(BusySlotSchema.safeParse({ startAt: ISO }).success).toBe(false);
  });
});

describe("ScheduleStepSchema", () => {
  const validStep = {
    stepId: "s1",
    stepLabel: "議事録を文字起こし",
    durationMinutes: 30,
    bandType: "work",
  };

  it("accepts valid work step", () => {
    expect(ScheduleStepSchema.safeParse(validStep).success).toBe(true);
  });

  it("accepts decision step with rationale", () => {
    expect(
      ScheduleStepSchema.safeParse({
        ...validStep,
        bandType: "decision",
        rationale: "上司確認が必要なため",
      }).success,
    ).toBe(true);
  });

  it("rejects saboru/busy bandType (work/decision only)", () => {
    expect(
      ScheduleStepSchema.safeParse({ ...validStep, bandType: "saboru" })
        .success,
    ).toBe(false);
    expect(
      ScheduleStepSchema.safeParse({ ...validStep, bandType: "busy" }).success,
    ).toBe(false);
  });

  it("rejects durationMinutes below 5 or above 480", () => {
    expect(
      ScheduleStepSchema.safeParse({ ...validStep, durationMinutes: 4 })
        .success,
    ).toBe(false);
    expect(
      ScheduleStepSchema.safeParse({ ...validStep, durationMinutes: 481 })
        .success,
    ).toBe(false);
  });

  it("rejects non-integer durationMinutes", () => {
    expect(
      ScheduleStepSchema.safeParse({ ...validStep, durationMinutes: 30.5 })
        .success,
    ).toBe(false);
  });

  it("rejects stepLabel over 60 chars", () => {
    expect(
      ScheduleStepSchema.safeParse({ ...validStep, stepLabel: "あ".repeat(61) })
        .success,
    ).toBe(false);
  });

  it("rejects empty stepId", () => {
    expect(
      ScheduleStepSchema.safeParse({ ...validStep, stepId: "" }).success,
    ).toBe(false);
  });

  it("accepts decision step with decisionAt (ISO time anchor)", () => {
    expect(
      ScheduleStepSchema.safeParse({
        ...validStep,
        bandType: "decision",
        decisionAt: "2026-05-24T16:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("accepts decisionAt with timezone offset (LLM 形式揺れ吸収)", () => {
    expect(
      ScheduleStepSchema.safeParse({
        ...validStep,
        bandType: "decision",
        decisionAt: "2026-05-24T16:00:00+09:00",
      }).success,
    ).toBe(true);
  });

  it("accepts step without decisionAt (optional)", () => {
    const result = ScheduleStepSchema.safeParse(validStep);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.decisionAt).toBeUndefined();
    }
  });

  it("rejects non-ISO decisionAt", () => {
    expect(
      ScheduleStepSchema.safeParse({ ...validStep, decisionAt: "16:00" })
        .success,
    ).toBe(false);
  });
});

describe("ScheduleBlockSchema", () => {
  const validBlock = {
    stepId: "s1",
    stepLabel: "議事録を文字起こし",
    bandType: "work",
    startAt: ISO,
    endAt: ISO2,
    durationMinutes: 30,
  };

  it("accepts valid work block", () => {
    expect(ScheduleBlockSchema.safeParse(validBlock).success).toBe(true);
  });

  it("accepts block with optional rationale", () => {
    expect(
      ScheduleBlockSchema.safeParse({ ...validBlock, rationale: "理由" })
        .success,
    ).toBe(true);
  });

  it("rejects empty stepId", () => {
    expect(
      ScheduleBlockSchema.safeParse({ ...validBlock, stepId: "" }).success,
    ).toBe(false);
  });

  it("rejects stepLabel over 80 chars", () => {
    expect(
      ScheduleBlockSchema.safeParse({
        ...validBlock,
        stepLabel: "あ".repeat(81),
      }).success,
    ).toBe(false);
  });

  it("rejects non-positive durationMinutes", () => {
    expect(
      ScheduleBlockSchema.safeParse({ ...validBlock, durationMinutes: 0 })
        .success,
    ).toBe(false);
  });

  it("rejects rationale over 200 chars", () => {
    expect(
      ScheduleBlockSchema.safeParse({
        ...validBlock,
        rationale: "x".repeat(201),
      }).success,
    ).toBe(false);
  });
});

describe("SaboriScheduleSchema", () => {
  const validSchedule = {
    taskId: "task-001",
    generatedAt: ISO,
    viewStartAt: ISO,
    viewEndAt: ISO2,
    deadline: ISO2,
    blocks: [
      {
        stepId: "s1",
        stepLabel: "作業",
        bandType: "work",
        startAt: ISO,
        endAt: ISO2,
        durationMinutes: 30,
      },
    ],
    totalSaboruMinutes: 120,
    calendarUsed: true,
  };

  it("accepts valid schedule", () => {
    expect(SaboriScheduleSchema.safeParse(validSchedule).success).toBe(true);
  });

  it("accepts null deadline", () => {
    expect(
      SaboriScheduleSchema.safeParse({ ...validSchedule, deadline: null })
        .success,
    ).toBe(true);
  });

  it("rejects empty blocks array", () => {
    expect(
      SaboriScheduleSchema.safeParse({ ...validSchedule, blocks: [] }).success,
    ).toBe(false);
  });

  it("rejects negative totalSaboruMinutes", () => {
    expect(
      SaboriScheduleSchema.safeParse({
        ...validSchedule,
        totalSaboruMinutes: -1,
      }).success,
    ).toBe(false);
  });

  it("rejects empty taskId", () => {
    expect(
      SaboriScheduleSchema.safeParse({ ...validSchedule, taskId: "" }).success,
    ).toBe(false);
  });
});

describe("ScheduleApiResponseSchema", () => {
  it("accepts wrapped schedule", () => {
    const result = ScheduleApiResponseSchema.safeParse({
      schedule: {
        taskId: "task-001",
        generatedAt: ISO,
        viewStartAt: ISO,
        viewEndAt: ISO2,
        deadline: null,
        blocks: [
          {
            stepId: "s1",
            stepLabel: "さぼろう",
            bandType: "saboru",
            startAt: ISO,
            endAt: ISO2,
            durationMinutes: 30,
          },
        ],
        totalSaboruMinutes: 30,
        calendarUsed: false,
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing schedule key", () => {
    expect(ScheduleApiResponseSchema.safeParse({}).success).toBe(false);
  });
});
