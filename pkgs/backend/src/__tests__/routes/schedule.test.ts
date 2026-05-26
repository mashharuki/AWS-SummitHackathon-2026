/**
 * GET /tasks/:taskId/schedule のテスト（U-G04）
 *
 * proposals.test.ts のテストアプリ構築パターンを踏襲。
 * SchedulePlannerAgent・各リポジトリ・getAccessToken・CalendarTimeslotService は
 * Partial / vi.fn モックで注入する。
 */

import type { SchedulePlannerAgent } from "@saboru/agent";
import type { SaboriSchedule, Task } from "@saboru/shared";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import type { DynamoServiceConnectionRepository } from "../../repositories/DynamoServiceConnectionRepository.js";
import type { DynamoTaskRepository } from "../../repositories/DynamoTaskRepository.js";
import {
  type GetAccessTokenFn,
  createScheduleRoute,
} from "../../routes/schedule.js";
import type { CalendarTimeslotService } from "../../services/CalendarTimeslotService.js";
import type { AppEnv } from "../../types.js";

const MOCK_USER_ID = "user-schedule-test";

function buildTestApp(
  taskRepo: Partial<DynamoTaskRepository>,
  connectionRepo: Partial<DynamoServiceConnectionRepository>,
  agent: Partial<SchedulePlannerAgent>,
  getAccessToken: GetAccessTokenFn = vi.fn().mockResolvedValue("dummy-token"),
  calendarService: Partial<CalendarTimeslotService> = {
    fetchBusySlots: vi.fn().mockResolvedValue([]),
  },
) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    (c as unknown as { env: unknown }).env = {
      requestContext: {
        authorizer: { jwt: { claims: { sub: MOCK_USER_ID } } },
      },
    };
    await next();
  });
  app.route(
    "/tasks",
    createScheduleRoute(
      taskRepo as DynamoTaskRepository,
      connectionRepo as DynamoServiceConnectionRepository,
      agent as SchedulePlannerAgent,
      getAccessToken,
      calendarService as CalendarTimeslotService,
    ),
  );
  app.onError(errorHandler);
  return app;
}

const sampleTask: Task = {
  PK: "USER#user-schedule-test",
  SK: "TASK#T01",
  taskId: "T01",
  userId: MOCK_USER_ID,
  status: "approved",
  title: "議事録をまとめる",
  deadline: "2099-01-01T09:00:00Z",
  requester: "",
  description: "",
  sourceType: "manual",
  approvedAt: "2026-05-17T00:00:00Z",
  updatedAt: "2026-05-17T00:00:00Z",
};

const sampleSchedule: SaboriSchedule = {
  taskId: "T01",
  generatedAt: "2026-05-25T00:00:00.000Z",
  viewStartAt: "2026-05-25T00:00:00.000Z",
  viewEndAt: "2026-05-25T08:00:00.000Z",
  deadline: "2099-01-01T09:00:00Z",
  blocks: [
    {
      stepId: "step-1",
      stepLabel: "議事録を文字起こし",
      bandType: "work",
      startAt: "2026-05-25T00:00:00.000Z",
      endAt: "2026-05-25T00:30:00.000Z",
      durationMinutes: 30,
    },
  ],
  totalSaboruMinutes: 120,
  calendarUsed: false,
};

const connectedGoogle = {
  PK: "USER#user-schedule-test",
  SK: "CONN#google",
  userId: MOCK_USER_ID,
  service: "google",
  status: "connected",
};

const sampleBusySlots = [
  { startAt: "2026-05-25T01:00:00.000Z", endAt: "2026-05-25T02:00:00.000Z" },
];

describe("GET /tasks/:taskId/schedule", () => {
  it("正常系: Google未連携 → busySlots=[]・calendarUsed=false で plan が呼ばれ schedule が返る", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    // 未連携: findByUserAndService は null
    const connectionRepo = {
      findByUserAndService: vi.fn().mockResolvedValue(null),
    };
    const mockPlan = vi.fn().mockResolvedValue(sampleSchedule);
    const agent = { plan: mockPlan };
    const getAccessToken = vi.fn().mockResolvedValue("should-not-be-called");
    const app = buildTestApp(taskRepo, connectionRepo, agent, getAccessToken);

    const res = await app.request("/tasks/T01/schedule");
    expect(res.status).toBe(200);

    // Cache-Control: no-store ヘッダの確認
    expect(res.headers.get("cache-control")).toBe("no-store");

    const body = await res.json();
    expect(body.schedule.taskId).toBe("T01");

    // plan が busySlots=[]・calendarUsed=false で呼ばれること
    expect(mockPlan).toHaveBeenCalledOnce();
    const planArg = mockPlan.mock.calls[0][0];
    expect(planArg.busySlots).toEqual([]);
    expect(planArg.calendarUsed).toBe(false);

    // 未連携なので token は取得されない
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("タスクが存在しない場合 404 を返す", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(null) };
    const connectionRepo = { findByUserAndService: vi.fn() };
    const agent = { plan: vi.fn() };
    const app = buildTestApp(taskRepo, connectionRepo, agent);

    const res = await app.request("/tasks/NOTFOUND/schedule");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("Google連携あり → getAccessToken が呼ばれ calendarUsed=true で busySlots が plan に渡る", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const connectionRepo = {
      findByUserAndService: vi.fn().mockResolvedValue(connectedGoogle),
    };
    const mockPlan = vi.fn().mockResolvedValue({
      ...sampleSchedule,
      calendarUsed: true,
    });
    const agent = { plan: mockPlan };
    const getAccessToken = vi.fn().mockResolvedValue("valid-token");
    const calendarService = {
      fetchBusySlots: vi.fn().mockResolvedValue(sampleBusySlots),
    };
    const app = buildTestApp(
      taskRepo,
      connectionRepo,
      agent,
      getAccessToken,
      calendarService,
    );

    const res = await app.request("/tasks/T01/schedule");
    expect(res.status).toBe(200);

    // token 取得が呼ばれる
    expect(getAccessToken).toHaveBeenCalledOnce();
    expect(getAccessToken).toHaveBeenCalledWith(MOCK_USER_ID);

    // fetchBusySlots に accessToken と取得ウィンドウが渡る
    expect(calendarService.fetchBusySlots).toHaveBeenCalledOnce();
    const fetchArg = vi.mocked(calendarService.fetchBusySlots).mock.calls[0][0];
    expect(fetchArg.accessToken).toBe("valid-token");
    expect(typeof fetchArg.windowStartAt).toBe("string");
    expect(typeof fetchArg.windowEndAt).toBe("string");

    // plan に calendarUsed=true・busySlots が渡る
    expect(mockPlan).toHaveBeenCalledOnce();
    const planArg = mockPlan.mock.calls[0][0];
    expect(planArg.calendarUsed).toBe(true);
    expect(planArg.busySlots).toEqual(sampleBusySlots);
  });

  it("カレンダー取得失敗（getAccessToken が throw）→ フォールバックで busySlots=[]・calendarUsed=false で続行（500にしない）", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const connectionRepo = {
      findByUserAndService: vi.fn().mockResolvedValue(connectedGoogle),
    };
    const mockPlan = vi.fn().mockResolvedValue(sampleSchedule);
    const agent = { plan: mockPlan };
    const getAccessToken = vi
      .fn()
      .mockRejectedValue(new Error("token refresh failed"));
    const app = buildTestApp(taskRepo, connectionRepo, agent, getAccessToken);

    const res = await app.request("/tasks/T01/schedule");
    // 500 にせずフォールバックして 200 を返す
    expect(res.status).toBe(200);

    const planArg = mockPlan.mock.calls[0][0];
    expect(planArg.busySlots).toEqual([]);
    expect(planArg.calendarUsed).toBe(false);
  });

  it("カレンダー取得失敗（fetchBusySlots が throw）→ フォールバックで続行（500にしない）", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const connectionRepo = {
      findByUserAndService: vi.fn().mockResolvedValue(connectedGoogle),
    };
    const mockPlan = vi.fn().mockResolvedValue(sampleSchedule);
    const agent = { plan: mockPlan };
    const getAccessToken = vi.fn().mockResolvedValue("valid-token");
    const calendarService = {
      fetchBusySlots: vi
        .fn()
        .mockRejectedValue(new Error("CALENDAR_API_ERROR")),
    };
    const app = buildTestApp(
      taskRepo,
      connectionRepo,
      agent,
      getAccessToken,
      calendarService,
    );

    const res = await app.request("/tasks/T01/schedule");
    expect(res.status).toBe(200);

    const planArg = mockPlan.mock.calls[0][0];
    expect(planArg.busySlots).toEqual([]);
    expect(planArg.calendarUsed).toBe(false);
  });

  it("agent.plan が返す schedule がそのまま { schedule } で返る", async () => {
    const taskRepo = { findById: vi.fn().mockResolvedValue(sampleTask) };
    const connectionRepo = {
      findByUserAndService: vi.fn().mockResolvedValue(null),
    };
    const agent = { plan: vi.fn().mockResolvedValue(sampleSchedule) };
    const app = buildTestApp(taskRepo, connectionRepo, agent);

    const res = await app.request("/tasks/T01/schedule");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schedule).toEqual(sampleSchedule);
  });
});
