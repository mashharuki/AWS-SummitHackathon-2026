import type {
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  ConverseStreamCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import type { Task } from "@saboru/shared";
import { describe, expect, it } from "vitest";
import type { IBedrockClient } from "../../bedrock/IBedrockClient.js";
import {
  SchedulePlannerAgent,
  normalizeToolDecisionAt,
} from "../SchedulePlannerAgent.js";
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
  /** converse が呼ばれた回数（Bedrock スキップ検証に使用） */
  converseCallCount = 0;
  constructor(private response: ConverseCommandOutput) {}
  async converse(_input: ConverseCommandInput): Promise<ConverseCommandOutput> {
    this.converseCallCount += 1;
    return this.response;
  }
  async converseStream(
    _input: ConverseStreamCommandInput,
  ): Promise<ConverseStreamCommandOutput> {
    throw new Error("not used");
  }
}

/** converse が呼ばれたら必ず失敗する mock（呼ばれてはいけないケース用） */
class ThrowingBedrockClient implements IBedrockClient {
  async converse(_input: ConverseCommandInput): Promise<ConverseCommandOutput> {
    throw new Error("converse should not be called");
  }
  async converseStream(
    _input: ConverseStreamCommandInput,
  ): Promise<ConverseStreamCommandOutput> {
    throw new Error("not used");
  }
}

const confirmedSteps = [
  {
    stepId: "u1",
    stepLabel: "ユーザー確定: 初稿",
    durationMinutes: 40,
    bandType: "work" as const,
  },
  {
    stepId: "u2",
    stepLabel: "ユーザー確定: 上司確認",
    durationMinutes: 20,
    bandType: "decision" as const,
  },
];

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

  it("カレンダー busy を避けて後ろ詰め配置し calendarUsed=true を反映する", async () => {
    const agent = new SchedulePlannerAgent(
      new MockBedrockClient(makeToolResponse(validSteps)),
    );
    // 締切 08:00。後ろ詰めなら締切直前に作業が来るので、締切直前(07:30-08:00)を
    // busy にすると、作業はそれを避けて手前へ詰められる。
    const schedule = await agent.plan({
      task: makeTask(),
      busySlots: [
        {
          startAt: "2026-05-24T07:30:00.000Z",
          endAt: "2026-05-24T08:00:00.000Z",
        },
      ],
      calendarUsed: true,
      now: NOW,
    });
    expect(schedule.calendarUsed).toBe(true);
    // s2 は busy(07:30-08:00) を避け、その手前 07:00-07:30 に。s1 は 06:30-07:00。
    const s2 = schedule.blocks.find((b) => b.stepId === "s2");
    expect(s2?.endAt).toBe("2026-05-24T07:30:00.000Z");
    const s1 = schedule.blocks.find((b) => b.stepId === "s1");
    expect(s1?.endAt).toBe("2026-05-24T07:00:00.000Z");
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

  it("plannedSteps があれば Bedrock を呼ばず確定済みステップを配置する", async () => {
    // converse が呼ばれたら失敗する mock。呼ばれないことを保証する。
    const agent = new SchedulePlannerAgent(new ThrowingBedrockClient());
    const schedule = await agent.plan({
      task: makeTask({ plannedSteps: confirmedSteps }),
      busySlots: [],
      calendarUsed: false,
      now: NOW,
    });
    // 確定済みステップ（u1 / u2）がそのまま配置されている
    const work = schedule.blocks.filter((b) => b.bandType !== "saboru");
    expect(work.map((b) => b.stepId)).toEqual(["u1", "u2"]);
    // 窓 180 分 - 作業 60 分 = 120 分のさぼろう
    expect(schedule.totalSaboruMinutes).toBe(120);
  });

  it("confirmed な decision(decisionAt付き) は時刻アンカーに固定される", async () => {
    const agent = new SchedulePlannerAgent(new ThrowingBedrockClient());
    const schedule = await agent.plan({
      task: makeTask({
        // 締切 08:00（now+3h）。確認を 07:00 に固定、その手前に作業。
        plannedSteps: [
          {
            stepId: "u1",
            stepLabel: "初稿",
            durationMinutes: 30,
            bandType: "work",
          },
          {
            stepId: "u2",
            stepLabel: "上司確認",
            durationMinutes: 10,
            bandType: "decision",
            decisionAt: "2026-05-24T07:00:00.000Z",
          },
        ],
      }),
      busySlots: [],
      calendarUsed: false,
      now: NOW,
    });
    const u2 = schedule.blocks.find((b) => b.stepId === "u2");
    // decision は 07:00 に固定（10分枠）
    expect(u2?.startAt).toBe("2026-05-24T07:00:00.000Z");
    expect(u2?.bandType).toBe("decision");
    const u1 = schedule.blocks.find((b) => b.stepId === "u1");
    // 作業は decision(07:00) の直前へ後ろ詰め → 06:30-07:00
    expect(u1?.endAt).toBe("2026-05-24T07:00:00.000Z");
  });

  it("plannedSteps が空配列なら従来通り Bedrock で分解する（後方互換）", async () => {
    const mock = new MockBedrockClient(makeToolResponse(validSteps));
    const agent = new SchedulePlannerAgent(mock);
    const schedule = await agent.plan({
      task: makeTask({ plannedSteps: [] }),
      busySlots: [],
      calendarUsed: false,
      now: NOW,
    });
    expect(mock.converseCallCount).toBe(1);
    const work = schedule.blocks.filter((b) => b.bandType !== "saboru");
    expect(work.map((b) => b.stepId)).toEqual(["s1", "s2"]);
  });

  it("plannedSteps 未設定（legacy task）なら従来通り Bedrock で分解する", async () => {
    const mock = new MockBedrockClient(makeToolResponse(validSteps));
    const agent = new SchedulePlannerAgent(mock);
    await agent.plan({
      task: makeTask(), // plannedSteps undefined
      busySlots: [],
      calendarUsed: false,
      now: NOW,
    });
    expect(mock.converseCallCount).toBe(1);
  });
});

describe("SchedulePlannerAgent.generateStepDraft", () => {
  it("正常系: Bedrock のステップ案をそのまま返す", async () => {
    const agent = new SchedulePlannerAgent(
      new MockBedrockClient(makeToolResponse(validSteps)),
    );
    const steps = await agent.generateStepDraft({
      title: "提案資料の初版作成",
      deadline: "2026-05-24T08:00:00.000Z",
      description: "クライアント向け提案資料の初版を作る",
      refId: "cand-1",
    });
    expect(steps).toHaveLength(2);
    expect(steps[0]?.stepId).toBe("s1");
    expect(steps[1]?.bandType).toBe("decision");
  });

  it("deadline=null / description 空でも動作する", async () => {
    const agent = new SchedulePlannerAgent(
      new MockBedrockClient(makeToolResponse(validSteps)),
    );
    const steps = await agent.generateStepDraft({
      title: "タイトルのみ",
      deadline: null,
      description: "",
    });
    expect(steps.length).toBeGreaterThan(0);
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
      agent.generateStepDraft({
        title: "x",
        deadline: null,
        description: "y",
      }),
    ).rejects.toThrow(/did not return plan_schedule/);
  });

  it("Zod バリデーション失敗時はエラーを投げる", async () => {
    const agent = new SchedulePlannerAgent(
      new MockBedrockClient(makeToolResponse({ steps: [{ stepId: "s1" }] })),
    );
    await expect(
      agent.generateStepDraft({
        title: "x",
        deadline: null,
        description: "y",
      }),
    ).rejects.toThrow(/schema validation/);
  });

  it("decision の decisionAt を保持して返す", async () => {
    const withDecision = {
      steps: [
        {
          stepId: "s1",
          stepLabel: "初稿を起こす",
          durationMinutes: 45,
          bandType: "work",
        },
        {
          stepId: "d1",
          stepLabel: "上司へ確認",
          durationMinutes: 10,
          bandType: "decision",
          decisionAt: "2026-05-24T07:00:00.000Z",
        },
      ],
    };
    const agent = new SchedulePlannerAgent(
      new MockBedrockClient(makeToolResponse(withDecision)),
    );
    const steps = await agent.generateStepDraft({
      title: "提案資料",
      deadline: "2026-05-24T08:00:00.000Z",
      description: "初稿を作って上司確認",
      now: NOW,
    });
    const d1 = steps.find((s) => s.stepId === "d1");
    expect(d1?.decisionAt).toBe("2026-05-24T07:00:00.000Z");
    expect(d1?.bandType).toBe("decision");
  });

  it("オフセット付き decisionAt を canonical ISO に正規化して受理する", async () => {
    // LLM がオフセット付き（+09:00）や秒なしで返しても 503 にせず正規化する
    const withOffset = {
      steps: [
        {
          stepId: "s1",
          stepLabel: "初稿",
          durationMinutes: 45,
          bandType: "work",
        },
        {
          stepId: "d1",
          stepLabel: "上司確認",
          durationMinutes: 10,
          bandType: "decision",
          decisionAt: "2026-05-24T16:00:00+09:00",
        },
      ],
    };
    const agent = new SchedulePlannerAgent(
      new MockBedrockClient(makeToolResponse(withOffset)),
    );
    const steps = await agent.generateStepDraft({
      title: "提案資料",
      deadline: "2026-05-24T08:00:00.000Z",
      description: "x",
      now: NOW,
    });
    const d1 = steps.find((s) => s.stepId === "d1");
    // +09:00 16:00 = UTC 07:00（canonical Z 形式）
    expect(d1?.decisionAt).toBe("2026-05-24T07:00:00.000Z");
  });

  it("解釈不能な decisionAt は落として処理を継続する", async () => {
    const withBad = {
      steps: [
        {
          stepId: "s1",
          stepLabel: "初稿",
          durationMinutes: 45,
          bandType: "work",
        },
        {
          stepId: "d1",
          stepLabel: "確認",
          durationMinutes: 10,
          bandType: "decision",
          decisionAt: "来週の金曜",
        },
      ],
    };
    const agent = new SchedulePlannerAgent(
      new MockBedrockClient(makeToolResponse(withBad)),
    );
    const steps = await agent.generateStepDraft({
      title: "x",
      deadline: null,
      description: "y",
      now: NOW,
    });
    const d1 = steps.find((s) => s.stepId === "d1");
    // 不正な decisionAt は除去され、503 にならない
    expect(d1).toBeDefined();
    expect(d1?.decisionAt).toBeUndefined();
  });
});

describe("normalizeToolDecisionAt", () => {
  it("オフセット付きを canonical ISO へ正規化する", () => {
    const out = normalizeToolDecisionAt({
      steps: [{ stepId: "d1", decisionAt: "2026-05-24T16:00:00+09:00" }],
    }) as { steps: { decisionAt?: string }[] };
    expect(out.steps[0].decisionAt).toBe("2026-05-24T07:00:00.000Z");
  });

  it("解釈不能な decisionAt は削除する", () => {
    const out = normalizeToolDecisionAt({
      steps: [{ stepId: "d1", decisionAt: "not-a-date" }],
    }) as { steps: { decisionAt?: string }[] };
    expect(out.steps[0].decisionAt).toBeUndefined();
    expect(out.steps[0].stepId).toBe("d1");
  });

  it("decisionAt の無いステップはそのまま", () => {
    const out = normalizeToolDecisionAt({
      steps: [{ stepId: "s1", durationMinutes: 30 }],
    }) as { steps: { decisionAt?: string }[] };
    expect(out.steps[0].decisionAt).toBeUndefined();
  });

  it("steps を持たない入力はそのまま返す", () => {
    expect(normalizeToolDecisionAt(null)).toBeNull();
    expect(normalizeToolDecisionAt({ foo: 1 })).toEqual({ foo: 1 });
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
