import type { Task } from "@saboru/shared";
import { describe, expect, it, vi } from "vitest";
import {
  assembleContextNarrative,
  calcNextCheckAt,
  deriveContextSignals,
  derivePsychSignals,
  determineContextCoverage,
} from "../contextUtils.js";
import type { CalendarContext, SlackContext, TaskContext } from "../types.js";

// ─────────────────────────────────────────────
// テストフィクスチャー
// ─────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    PK: "USER#test-user",
    SK: "TASK#01HXY",
    taskId: "01HXY",
    userId: "test-user",
    status: "approved",
    title: "資料作成",
    deadline: null,
    requester: "abc123",
    description: "来週のMTG用の資料を作成する",
    sourceType: "slack",
    approvedAt: "2026-05-17T09:00:00Z",
    updatedAt: "2026-05-17T09:00:00Z",
    ...overrides,
  };
}

function makeSlackContext(overrides: Partial<SlackContext> = {}): SlackContext {
  return {
    requesterStatus: "online",
    reminderCount: 0,
    urgencyKeywords: [],
    threadActive: false,
    rawSummary: "テスト用サマリ",
    ...overrides,
  };
}

// 未来の期限: 現在から約 30 時間後
const futureDeadline = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();
// 近い期限: 現在から約 3 時間後
const nearDeadline = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
// 過去の期限
const pastDeadline = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

// ─────────────────────────────────────────────
// determineContextCoverage
// ─────────────────────────────────────────────

describe("determineContextCoverage", () => {
  it("returns 'full' when both Slack context and deadline are present", () => {
    const context: TaskContext = {
      task: makeTask({ deadline: futureDeadline }),
      slackContext: makeSlackContext(),
    };
    expect(determineContextCoverage(context)).toBe("full");
  });

  it("returns 'partial' when only Slack context is present", () => {
    const context: TaskContext = {
      task: makeTask({ deadline: null }),
      slackContext: makeSlackContext(),
    };
    expect(determineContextCoverage(context)).toBe("partial");
  });

  it("returns 'partial' when only deadline is present", () => {
    const context: TaskContext = {
      task: makeTask({ deadline: futureDeadline }),
      slackContext: undefined,
    };
    expect(determineContextCoverage(context)).toBe("partial");
  });

  it("returns 'minimal' when neither Slack nor deadline is present", () => {
    const context: TaskContext = {
      task: makeTask({ deadline: null }),
    };
    expect(determineContextCoverage(context)).toBe("minimal");
  });
});

// ─────────────────────────────────────────────
// derivePsychSignals
// ─────────────────────────────────────────────

describe("derivePsychSignals", () => {
  describe("taskIdentifiability (Identifiability / Williams 1981)", () => {
    it("is 'high' when requester is online", () => {
      const context: TaskContext = {
        task: makeTask(),
        slackContext: makeSlackContext({ requesterStatus: "online" }),
      };
      const signals = derivePsychSignals(context);
      expect(signals?.taskIdentifiability).toBe("high");
    });

    it("is 'low' when requester is away", () => {
      const context: TaskContext = {
        task: makeTask(),
        slackContext: makeSlackContext({ requesterStatus: "away" }),
      };
      const signals = derivePsychSignals(context);
      expect(signals?.taskIdentifiability).toBe("low");
    });

    it("is 'low' when requester is offline", () => {
      const context: TaskContext = {
        task: makeTask(),
        slackContext: makeSlackContext({ requesterStatus: "offline" }),
      };
      const signals = derivePsychSignals(context);
      expect(signals?.taskIdentifiability).toBe("low");
    });

    it("is 'unknown' when no Slack context", () => {
      const context: TaskContext = { task: makeTask() };
      const signals = derivePsychSignals(context);
      expect(signals?.taskIdentifiability).toBe("unknown");
    });
  });

  describe("perceivedPeerEffort (Sucker Effect / Kerr 1983)", () => {
    it("is 'high' when requester is online", () => {
      const context: TaskContext = {
        task: makeTask(),
        slackContext: makeSlackContext({ requesterStatus: "online" }),
      };
      const signals = derivePsychSignals(context);
      expect(signals?.perceivedPeerEffort).toBe("high");
    });

    it("is 'low' when requester is offline", () => {
      const context: TaskContext = {
        task: makeTask(),
        slackContext: makeSlackContext({ requesterStatus: "offline" }),
      };
      const signals = derivePsychSignals(context);
      expect(signals?.perceivedPeerEffort).toBe("low");
    });
  });

  describe("externalPressureLevel (SDT / Ryan & Deci 2000)", () => {
    it("is 'high' when reminderCount >= 2", () => {
      const context: TaskContext = {
        task: makeTask(),
        slackContext: makeSlackContext({ reminderCount: 2 }),
      };
      const signals = derivePsychSignals(context);
      expect(signals?.externalPressureLevel).toBe("high");
    });

    it("is 'high' when urgency keywords present", () => {
      const context: TaskContext = {
        task: makeTask(),
        slackContext: makeSlackContext({
          reminderCount: 0,
          urgencyKeywords: ["urgent", "asap"],
        }),
      };
      const signals = derivePsychSignals(context);
      expect(signals?.externalPressureLevel).toBe("high");
    });

    it("is 'low' when reminderCount is 0 and no urgency keywords", () => {
      const context: TaskContext = {
        task: makeTask(),
        slackContext: makeSlackContext({
          reminderCount: 0,
          urgencyKeywords: [],
        }),
      };
      const signals = derivePsychSignals(context);
      expect(signals?.externalPressureLevel).toBe("low");
    });

    it("is 'unknown' when no Slack context", () => {
      const context: TaskContext = { task: makeTask() };
      const signals = derivePsychSignals(context);
      expect(signals?.externalPressureLevel).toBe("unknown");
    });
  });

  describe("effortOutcomeExpectancy (Expectancy Theory / Vroom 1964)", () => {
    it("is 'high' when deadline is more than 24 hours away", () => {
      const context: TaskContext = {
        task: makeTask({ deadline: futureDeadline }),
      };
      const signals = derivePsychSignals(context);
      expect(signals?.effortOutcomeExpectancy).toBe("high");
    });

    it("is 'low' when deadline is less than 4 hours away", () => {
      const context: TaskContext = {
        task: makeTask({ deadline: nearDeadline }),
      };
      const signals = derivePsychSignals(context);
      expect(signals?.effortOutcomeExpectancy).toBe("low");
    });

    it("is 'low' when deadline has passed", () => {
      const context: TaskContext = {
        task: makeTask({ deadline: pastDeadline }),
      };
      const signals = derivePsychSignals(context);
      expect(signals?.effortOutcomeExpectancy).toBe("low");
    });

    it("is 'low' when deadline is between 4 and 24 hours away (borderline zone)", () => {
      // 12 時間後 — 4h～24h のボーダーラインゾーン
      const borderlineDeadline = new Date(
        Date.now() + 12 * 60 * 60 * 1000,
      ).toISOString();
      const context: TaskContext = {
        task: makeTask({ deadline: borderlineDeadline }),
      };
      const signals = derivePsychSignals(context);
      // 4h～24h: 実装により 'low' として扱われる
      expect(signals?.effortOutcomeExpectancy).toBe("low");
    });

    it("is 'unknown' when no deadline", () => {
      const context: TaskContext = { task: makeTask({ deadline: null }) };
      const signals = derivePsychSignals(context);
      expect(signals?.effortOutcomeExpectancy).toBe("unknown");
    });
  });

  describe("externalPressureLevel — reminder count 1 (borderline)", () => {
    it("is 'low' when reminderCount is 1 and no urgency keywords", () => {
      const context: TaskContext = {
        task: makeTask(),
        slackContext: makeSlackContext({
          reminderCount: 1,
          urgencyKeywords: [],
        }),
      };
      const signals = derivePsychSignals(context);
      // reminderCount===1 かつ urgency キーワードなし → low-medium 扱い → "low"
      expect(signals?.externalPressureLevel).toBe("low");
    });
  });
});

// ─────────────────────────────────────────────
// deriveContextSignals
// ─────────────────────────────────────────────

describe("deriveContextSignals", () => {
  it("has correct hasReminder flag", () => {
    const context: TaskContext = {
      task: makeTask(),
      slackContext: makeSlackContext({ reminderCount: 1 }),
    };
    const signals = deriveContextSignals(context);
    expect(signals.hasReminder).toBe(true);
  });

  it("has hasReminder=false when no Slack context", () => {
    const context: TaskContext = { task: makeTask() };
    const signals = deriveContextSignals(context);
    expect(signals.hasReminder).toBe(false);
  });

  it("has correct hasUrgentKeyword flag", () => {
    const context: TaskContext = {
      task: makeTask(),
      slackContext: makeSlackContext({ urgencyKeywords: ["ASAP"] }),
    };
    const signals = deriveContextSignals(context);
    expect(signals.hasUrgentKeyword).toBe(true);
  });

  it("includes deadlineMinutes when deadline is set", () => {
    const context: TaskContext = {
      task: makeTask({ deadline: futureDeadline }),
    };
    const signals = deriveContextSignals(context);
    expect(signals.deadlineMinutes).toBeDefined();
    expect(typeof signals.deadlineMinutes).toBe("number");
    // 約 30 時間 * 60 = 約 1800 分 (許容誤差 ±5 分)
    expect(signals.deadlineMinutes!).toBeGreaterThan(1700);
    expect(signals.deadlineMinutes!).toBeLessThan(1900);
  });

  it("has deadlineMinutes=undefined when no deadline", () => {
    const context: TaskContext = { task: makeTask({ deadline: null }) };
    const signals = deriveContextSignals(context);
    expect(signals.deadlineMinutes).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// assembleContextNarrative
// ─────────────────────────────────────────────

describe("assembleContextNarrative", () => {
  it("includes task title and description", () => {
    const context: TaskContext = { task: makeTask() };
    const narrative = assembleContextNarrative(context);
    expect(narrative).toContain("資料作成");
    expect(narrative).toContain("来週のMTG用の資料を作成する");
  });

  it("includes '締切まで' when deadline is set", () => {
    const context: TaskContext = {
      task: makeTask({ deadline: futureDeadline }),
    };
    const narrative = assembleContextNarrative(context);
    expect(narrative).toContain("締切まで");
  });

  it("includes '未設定' when no deadline", () => {
    const context: TaskContext = { task: makeTask({ deadline: null }) };
    const narrative = assembleContextNarrative(context);
    expect(narrative).toContain("未設定");
  });

  it("includes Slack context details when provided", () => {
    const context: TaskContext = {
      task: makeTask(),
      slackContext: makeSlackContext({
        requesterStatus: "away",
        reminderCount: 1,
        urgencyKeywords: ["urgent"],
        threadActive: true,
      }),
    };
    const narrative = assembleContextNarrative(context);
    expect(narrative).toContain("away");
    expect(narrative).toContain("1回");
    expect(narrative).toContain("urgent");
    expect(narrative).toContain("あり");
  });

  it("includes 'Slack コンテキストなし' when no Slack context", () => {
    const context: TaskContext = { task: makeTask() };
    const narrative = assembleContextNarrative(context);
    expect(narrative).toContain("Slack コンテキストなし");
  });

  it("includes reminder note when reminderCount is 0", () => {
    const context: TaskContext = {
      task: makeTask(),
      slackContext: makeSlackContext({ reminderCount: 0 }),
    };
    const narrative = assembleContextNarrative(context);
    expect(narrative).toContain("リマインドなし");
  });

  it("includes away status note when requester is away", () => {
    const context: TaskContext = {
      task: makeTask(),
      slackContext: makeSlackContext({ requesterStatus: "away" }),
    };
    const narrative = assembleContextNarrative(context);
    expect(narrative).toContain("away");
  });

  it("includes '過ぎています（期限切れ）' when deadline has already passed", () => {
    const context: TaskContext = {
      task: makeTask({ deadline: pastDeadline }),
    };
    const narrative = assembleContextNarrative(context);
    expect(narrative).toContain("過ぎています（期限切れ）");
  });

  it("formats past deadline under 1 hour without hour prefix", () => {
    const soonPastDeadline = new Date(
      Date.now() - 10 * 60 * 1000,
    ).toISOString();
    const context: TaskContext = {
      task: makeTask({ deadline: soonPastDeadline }),
    };
    const narrative = assembleContextNarrative(context);

    expect(narrative).toMatch(/\d+分 過ぎています/);
    expect(narrative).not.toContain("0時間10分");
  });

  it("omits description line when description is not provided", () => {
    const context: TaskContext = {
      task: makeTask({ description: undefined }),
    };
    const narrative = assembleContextNarrative(context);
    // description なしのタスクは '説明:' 行を持つべきでない
    expect(narrative).not.toContain("- 説明:");
  });

  it("falls back to raw deadline when locale formatting throws", () => {
    const spy = vi
      .spyOn(Date.prototype, "toLocaleString")
      .mockImplementation(() => {
        throw new Error("locale failure");
      });
    const rawDeadline = "not-a-date";
    const context: TaskContext = {
      task: makeTask({ deadline: rawDeadline }),
    };

    const narrative = assembleContextNarrative(context);

    expect(narrative).toContain(rawDeadline);
    spy.mockRestore();
  });
});

// ─────────────────────────────────────────────
// calcNextCheckAt
// ─────────────────────────────────────────────

describe("calcNextCheckAt", () => {
  it("returns ISO 8601 string", () => {
    const result = calcNextCheckAt(60);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("adds correct minutes offset from given date", () => {
    const now = new Date("2026-05-17T12:00:00Z");
    const result = calcNextCheckAt(120, now);
    expect(result).toBe("2026-05-17T14:00:00.000Z");
  });

  it("handles 0 minutes offset", () => {
    const now = new Date("2026-05-17T12:00:00Z");
    const result = calcNextCheckAt(0, now);
    expect(result).toBe("2026-05-17T12:00:00.000Z");
  });

  it("handles large offsets (e.g. 360 minutes = 6 hours)", () => {
    const now = new Date("2026-05-17T00:00:00Z");
    const result = calcNextCheckAt(360, now);
    expect(result).toBe("2026-05-17T06:00:00.000Z");
  });
});

// ─────────────────────────────────────────────
// Calendar コンテキスト統合テスト（U-07b / BR-G-06）
// ─────────────────────────────────────────────

function makeCalendarContext(
  overrides: Partial<CalendarContext> = {},
): CalendarContext {
  return {
    upcomingEventCount: 2,
    nextEventStartsInMinutes: 60,
    freeSlotMinutesToday: 180,
    busyScore: 0.5,
    fetchedAt: "2026-05-24T10:00:00.000Z",
    ...overrides,
  };
}

describe("derivePsychSignals — calendarBusyness（BR-G-06）", () => {
  it("calendarBusyness='high' when busyScore >= 0.7", () => {
    const context: TaskContext = {
      task: makeTask(),
      calendarContext: makeCalendarContext({ busyScore: 0.8 }),
    };
    const signals = derivePsychSignals(context);
    expect(signals?.calendarBusyness).toBe("high");
  });

  it("calendarBusyness='low' when busyScore <= 0.3", () => {
    const context: TaskContext = {
      task: makeTask(),
      calendarContext: makeCalendarContext({ busyScore: 0.2 }),
    };
    const signals = derivePsychSignals(context);
    expect(signals?.calendarBusyness).toBe("low");
  });

  it("calendarBusyness='unknown' when busyScore is between 0.3 and 0.7", () => {
    const context: TaskContext = {
      task: makeTask(),
      calendarContext: makeCalendarContext({ busyScore: 0.5 }),
    };
    const signals = derivePsychSignals(context);
    expect(signals?.calendarBusyness).toBe("unknown");
  });

  it("calendarBusyness='unknown' when no calendarContext", () => {
    const context: TaskContext = { task: makeTask() };
    const signals = derivePsychSignals(context);
    expect(signals?.calendarBusyness).toBe("unknown");
  });
});

describe("derivePsychSignals — nextMeetingPressure（BR-G-06）", () => {
  it("nextMeetingPressure='high' when nextEventStartsInMinutes < 30", () => {
    const context: TaskContext = {
      task: makeTask(),
      calendarContext: makeCalendarContext({ nextEventStartsInMinutes: 15 }),
    };
    const signals = derivePsychSignals(context);
    expect(signals?.nextMeetingPressure).toBe("high");
  });

  it("nextMeetingPressure='low' when nextEventStartsInMinutes >= 30", () => {
    const context: TaskContext = {
      task: makeTask(),
      calendarContext: makeCalendarContext({ nextEventStartsInMinutes: 90 }),
    };
    const signals = derivePsychSignals(context);
    expect(signals?.nextMeetingPressure).toBe("low");
  });

  it("nextMeetingPressure='unknown' when nextEventStartsInMinutes is null", () => {
    const context: TaskContext = {
      task: makeTask(),
      calendarContext: makeCalendarContext({ nextEventStartsInMinutes: null }),
    };
    const signals = derivePsychSignals(context);
    expect(signals?.nextMeetingPressure).toBe("unknown");
  });

  it("nextMeetingPressure='unknown' when no calendarContext", () => {
    const context: TaskContext = { task: makeTask() };
    const signals = derivePsychSignals(context);
    expect(signals?.nextMeetingPressure).toBe("unknown");
  });
});

describe("deriveContextSignals — nearestMeetingMinutes（BR-G-06）", () => {
  it("nearestMeetingMinutes is set from calendarContext", () => {
    const context: TaskContext = {
      task: makeTask(),
      calendarContext: makeCalendarContext({ nextEventStartsInMinutes: 45 }),
    };
    const signals = deriveContextSignals(context);
    expect(signals.nearestMeetingMinutes).toBe(45);
  });

  it("nearestMeetingMinutes is undefined when no calendarContext", () => {
    const context: TaskContext = { task: makeTask() };
    const signals = deriveContextSignals(context);
    expect(signals.nearestMeetingMinutes).toBeUndefined();
  });

  it("nearestMeetingMinutes is undefined when nextEventStartsInMinutes is null", () => {
    const context: TaskContext = {
      task: makeTask(),
      calendarContext: makeCalendarContext({ nextEventStartsInMinutes: null }),
    };
    const signals = deriveContextSignals(context);
    expect(signals.nearestMeetingMinutes).toBeUndefined();
  });
});

describe("assembleContextNarrative — Calendar コンテキスト（BR-G-06）", () => {
  it("Calendar セクションを含む when calendarContext あり", () => {
    const context: TaskContext = {
      task: makeTask(),
      calendarContext: makeCalendarContext({
        upcomingEventCount: 3,
        nextEventStartsInMinutes: 45,
        freeSlotMinutesToday: 120,
        busyScore: 0.6,
      }),
    };
    const narrative = assembleContextNarrative(context);
    expect(narrative).toContain("Googleカレンダーの状況");
    expect(narrative).toContain("3件");
    expect(narrative).toContain("45分");
    expect(narrative).toContain("120分");
    expect(narrative).toContain("0.60");
  });

  it("次の予定なし と表示する when nextEventStartsInMinutes is null", () => {
    const context: TaskContext = {
      task: makeTask(),
      calendarContext: makeCalendarContext({ nextEventStartsInMinutes: null }),
    };
    const narrative = assembleContextNarrative(context);
    expect(narrative).toContain("予定なし");
  });

  it("Calendar セクションを含まない when calendarContext なし", () => {
    const context: TaskContext = { task: makeTask() };
    const narrative = assembleContextNarrative(context);
    expect(narrative).not.toContain("Googleカレンダーの状況");
  });
});
