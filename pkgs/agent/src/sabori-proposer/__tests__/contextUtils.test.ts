import { describe, expect, it } from "vitest";
import type { TaskContext, SlackContext } from "../types.js";
import {
  assembleContextNarrative,
  calcNextCheckAt,
  deriveContextSignals,
  derivePsychSignals,
  determineContextCoverage,
} from "../contextUtils.js";
import type { Task } from "@saboru/shared";

// ─────────────────────────────────────────────
// Test fixtures
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

// Future deadline: ~30 hours from now
const futureDeadline = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();
// Near deadline: ~3 hours from now
const nearDeadline = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
// Past deadline
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
      // 12 hours from now — in the 4h-24h borderline zone
      const borderlineDeadline = new Date(
        Date.now() + 12 * 60 * 60 * 1000,
      ).toISOString();
      const context: TaskContext = {
        task: makeTask({ deadline: borderlineDeadline }),
      };
      const signals = derivePsychSignals(context);
      // 4h–24h: treated as 'low' per implementation
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
      // reminderCount===1 and no urgency → treated as low-medium → "low"
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
    // ~30 hours * 60 = ~1800 minutes (allow ±5 min tolerance)
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

  it("omits description line when description is not provided", () => {
    const context: TaskContext = {
      task: makeTask({ description: undefined }),
    };
    const narrative = assembleContextNarrative(context);
    // Task without description should not have '説明:' line
    expect(narrative).not.toContain("- 説明:");
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
