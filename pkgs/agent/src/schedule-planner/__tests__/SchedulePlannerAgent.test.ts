import type {
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  ConverseStreamCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import type { Task } from "@saboru/shared";
import { describe, expect, it } from "vitest";
import type { IBedrockClient } from "../../bedrock/IBedrockClient.js";
import { SchedulePlannerAgent } from "../SchedulePlannerAgent.js";
import {
  PLAN_SCHEDULE_TOOL,
  PLAN_SCHEDULE_TOOL_NAME,
  PlanScheduleOutputSchema,
  ScheduleStepSchema,
} from "../tools.js";

// ─────────────────────────────────────────────
// MockBedrockClient
// ─────────────────────────────────────────────

class MockBedrockClient implements IBedrockClient {
  constructor(private response: ConverseCommandOutput) {}
  async converse(_input: ConverseCommandInput): Promise<ConverseCommandOutput> {
    return this.response;
  }
  async converseStream(
    _input: ConverseStreamCommandInput,
  ): Promise<ConverseStreamCommandOutput> {
    throw new Error("not used");
  }
}

function makeToolResponse(input: unknown): ConverseCommandOutput {
  return {
    $metadata: {},
    output: {
      message: {
        role: "assistant",
        content: [
          {
            toolUse: {
              toolUseId: "tool-sched-1",
              name: PLAN_SCHEDULE_TOOL_NAME,
              input,
            },
          },
        ],
      },
    },
    stopReason: "tool_use",
    usage: { inputTokens: 100, outputTokens: 60, totalTokens: 160 },
    metrics: { latencyMs: 400 },
  };
}

const NOW = "2026-05-24T05:00:00.000Z";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    PK: "USER#u1",
    SK: "TASK#t1",
    taskId: "t1",
    userId: "u1",
    status: "approved",
    title: "提案資料の初版作成",
    deadline: "2026-05-24T08:00:00.000Z", // now + 3h
    requester: "hashed",
    description: "クライアント向け提案資料の初版を作る",
    sourceType: "slack",
    approvedAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const validSteps = {
  steps: [
    {
      stepId: "s1",
      stepLabel: "議事録を文字起こし",
      durationMinutes: 30,
      bandType: "work",
    },
    {
      stepId: "s2",
      stepLabel: "上司へ確認依頼",
      durationMinutes: 30,
      bandType: "decision",
      rationale: "方針確認が必要",
    },
  ],
};

describe("SchedulePlannerAgent.plan", () => {
  it("正常系: ステップ分解 + さぼろう帯を含む SaboriSchedule を返す", async () => {
    const agent = new SchedulePlannerAgent(
      new MockBedrockClient(makeToolResponse(validSteps)),
    );
    const schedule = await agent.plan({
      task: makeTask(),
      busySlots: [],
      calendarUsed: false,
      now: NOW,
    });

    expect(schedule.taskId).toBe("t1");
    expect(schedule.calendarUsed).toBe(false);
    expect(schedule.deadline).toBe("2026-05-24T08:00:00.000Z");
    // work 2 + saboru >= 1
    const work = schedule.blocks.filter((b) => b.bandType !== "saboru");
    expect(work).toHaveLength(2);
    // 窓 180 分 - 作業 60 分 = 120 分のさぼろう
    expect(schedule.totalSaboruMinutes).toBe(120);
    expect(schedule.viewStartAt).toBe(NOW);
    expect(schedule.viewEndAt).toBe("2026-05-24T08:00:00.000Z");
  });

  it("カレンダー busy を避けて配置し calendarUsed=true を反映する", async () => {
    const agent = new SchedulePlannerAgent(
      new MockBedrockClient(makeToolResponse(validSteps)),
    );
    const schedule = await agent.plan({
      task: makeTask(),
      busySlots: [
        {
          startAt: "2026-05-24T05:00:00.000Z",
          endAt: "2026-05-24T05:30:00.000Z",
        },
      ],
      calendarUsed: true,
      now: NOW,
    });
    expect(schedule.calendarUsed).toBe(true);
    const s1 = schedule.blocks.find((b) => b.stepId === "s1");
    // busy(0-30) を避け、s1 は 05:30 から
    expect(s1?.startAt).toBe("2026-05-24T05:30:00.000Z");
  });

  it("now 省略時は現在時刻を使う", async () => {
    const agent = new SchedulePlannerAgent(
      new MockBedrockClient(makeToolResponse(validSteps)),
    );
    const schedule = await agent.plan({
      task: makeTask({ deadline: null }),
      busySlots: [],
      calendarUsed: false,
    });
    expect(schedule.blocks.length).toBeGreaterThan(0);
    expect(schedule.deadline).toBeNull();
  });

  it("toolUse が無い場合はエラーを投げる", async () => {
    const agent = new SchedulePlannerAgent(
      new MockBedrockClient({
        $metadata: {},
        output: {
          message: { role: "assistant", content: [{ text: "no tool" }] },
        },
        stopReason: "end_turn",
      }),
    );
    await expect(
      agent.plan({
        task: makeTask(),
        busySlots: [],
        calendarUsed: false,
        now: NOW,
      }),
    ).rejects.toThrow(/did not return plan_schedule/);
  });

  it("Zod バリデーション失敗時はエラーを投げる", async () => {
    const agent = new SchedulePlannerAgent(
      new MockBedrockClient(
        makeToolResponse({ steps: [{ stepId: "s1" }] }), // 必須欠落 + minItems 違反
      ),
    );
    await expect(
      agent.plan({
        task: makeTask(),
        busySlots: [],
        calendarUsed: false,
        now: NOW,
      }),
    ).rejects.toThrow(/schema validation/);
  });

  it("description 無しタスクでも動作する", async () => {
    const agent = new SchedulePlannerAgent(
      new MockBedrockClient(makeToolResponse(validSteps)),
    );
    const schedule = await agent.plan({
      task: makeTask({ description: "" }),
      busySlots: [],
      calendarUsed: false,
      now: NOW,
    });
    expect(schedule.blocks.length).toBeGreaterThan(0);
  });
});

describe("plan_schedule tool スキーマ", () => {
  it("ツール定義の名前が一致する", () => {
    expect(PLAN_SCHEDULE_TOOL.toolSpec?.name).toBe(PLAN_SCHEDULE_TOOL_NAME);
  });

  it("ScheduleStepSchema: 正常系", () => {
    expect(
      ScheduleStepSchema.safeParse({
        stepId: "s1",
        stepLabel: "作業",
        durationMinutes: 30,
        bandType: "work",
      }).success,
    ).toBe(true);
  });

  it("ScheduleStepSchema: saboru は不可（work/decision のみ）", () => {
    expect(
      ScheduleStepSchema.safeParse({
        stepId: "s1",
        stepLabel: "作業",
        durationMinutes: 30,
        bandType: "saboru",
      }).success,
    ).toBe(false);
  });

  it("ScheduleStepSchema: durationMinutes 範囲外を弾く", () => {
    expect(
      ScheduleStepSchema.safeParse({
        stepId: "s1",
        stepLabel: "作業",
        durationMinutes: 4,
        bandType: "work",
      }).success,
    ).toBe(false);
  });

  it("PlanScheduleOutputSchema: 1 ステップは minItems 違反", () => {
    expect(
      PlanScheduleOutputSchema.safeParse({
        steps: [
          {
            stepId: "s1",
            stepLabel: "作業",
            durationMinutes: 30,
            bandType: "work",
          },
        ],
      }).success,
    ).toBe(false);
  });
});
