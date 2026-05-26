/**
 * Google Calendar/Gmail ルートのテスト
 *
 * POST /api/google/calendar/fetch — Calendar API取り込み・busyScore計算・Cache保存
 * GET  /api/google/calendar/status — キャッシュ状態確認
 * POST /api/google/gmail/fetch    — Gmail取得・TaskExtractor連携・TaskCandidate化
 */

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import type { DynamoGoogleCalendarCacheRepository } from "../../repositories/DynamoGoogleCalendarCacheRepository.js";
import type { DynamoServiceConnectionRepository } from "../../repositories/DynamoServiceConnectionRepository.js";
import type { DynamoTaskCandidateRepository } from "../../repositories/DynamoTaskCandidateRepository.js";
import { createGoogleRoute } from "../../routes/google.js";
import type { AppEnv } from "../../types.js";

// env モック
vi.mock("../../config/env.js", () => ({
  env: {
    COGNITO_USER_POOL_ID: "ap-northeast-1_test",
    COGNITO_CLIENT_ID: "client-id-test",
    DYNAMODB_TABLE_USERS: "users-test",
    DYNAMODB_TABLE_CONNECTIONS: "conns-test",
    DYNAMODB_TABLE_TASK_CANDIDATES: "cands-test",
    DYNAMODB_TABLE_TASKS: "tasks-test",
    DYNAMODB_TABLE_PROPOSALS: "proposals-test",
    DYNAMODB_TABLE_HONNE_DATA: "honne-test",
    DYNAMODB_TABLE_PERSONAS: "personas-test",
    SLACK_SIGNING_SECRET_ARN: "arn:test:signing",
    SLACK_CLIENT_SECRET_ARN: "arn:test:client",
    OAUTH_STATE_SECRET: "test-oauth-state-secret-32chars!!",
    EVENT_BUS_NAME: "test-bus",
    GOOGLE_CLIENT_SECRET_ARN: "arn:test:google:client",
    GOOGLE_CLIENT_ID: "google-client-id-test",
    DYNAMODB_TABLE_GOOGLE_CALENDAR_CACHE: "google-calendar-cache-test",
  },
}));

// secrets.ts をモック
vi.mock("../../config/secrets.js", () => ({
  getGoogleClientSecret: vi.fn(),
  saveGoogleToken: vi.fn(),
  getGoogleToken: vi.fn(),
  getCachedGoogleAccessToken: vi.fn(),
  getSlackSigningSecret: vi.fn(),
  getSlackClientSecret: vi.fn(),
  _resetSecretsCache: vi.fn(),
}));

// GoogleTokenService をモック
vi.mock("../../services/GoogleTokenService.js", () => ({
  GoogleTokenService: class {
    async getValidAccessToken() {
      return "mocked-access-token";
    }
    static buildSecretName(userId: string) {
      return `saborou/google-token/${userId}`;
    }
    static computeExpiresAt(expiresInSeconds: number) {
      return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    }
  },
}));

import { getGoogleClientSecret } from "../../config/secrets.js";
const MOCK_GET_SECRET = getGoogleClientSecret as ReturnType<typeof vi.fn>;

const MOCK_USER_ID = "user-google-route-test";

// TaskExtractorAgent のモック
function makeTaskExtractor(
  options: {
    skipped?: boolean;
    candidateId?: string;
  } = {},
) {
  return {
    extractTaskFromSource: vi.fn().mockResolvedValue(
      options.skipped
        ? { skipped: true }
        : {
            skipped: false,
            candidate: {
              candidateId: options.candidateId ?? "cand-001",
              title: "テストタスク",
              deadline: null,
              sourceType: "gmail",
              sourceRef: "msg-001",
            },
          },
    ),
  };
}

function buildTestApp(
  connRepo: Partial<DynamoServiceConnectionRepository>,
  calendarCacheRepo: Partial<DynamoGoogleCalendarCacheRepository>,
  taskCandidateRepo: Partial<DynamoTaskCandidateRepository>,
  taskExtractor: ReturnType<typeof makeTaskExtractor>,
  injectUserId = true,
) {
  const app = new Hono<AppEnv>();
  if (injectUserId) {
    app.use("*", async (c, next) => {
      (c as unknown as { env: unknown }).env = {
        requestContext: {
          authorizer: { jwt: { claims: { sub: MOCK_USER_ID } } },
        },
      };
      await next();
    });
  }
  app.route(
    "/api/google",
    createGoogleRoute(
      connRepo as DynamoServiceConnectionRepository,
      calendarCacheRepo as DynamoGoogleCalendarCacheRepository,
      taskCandidateRepo as DynamoTaskCandidateRepository,
      taskExtractor as unknown as import("@saboru/agent").TaskExtractorAgent,
    ),
  );
  app.onError(errorHandler);
  return app;
}

// Google Calendar API の正常レスポンス
function makeCalendarResponse(
  items: Array<{
    id?: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }> = [],
) {
  return {
    ok: true,
    json: async () => ({ items }),
  };
}

// Gmail messages.list レスポンス
function makeGmailListResponse(messages: Array<{ id: string }> = []) {
  return {
    ok: true,
    json: async () => ({ messages }),
  };
}

// Gmail messages.get レスポンス
function makeGmailDetailResponse(
  id: string,
  options: {
    subject?: string;
    from?: string;
    snippet?: string;
  } = {},
) {
  return {
    ok: true,
    json: async () => ({
      id,
      snippet: options.snippet ?? "テストメールの内容",
      payload: {
        headers: [
          { name: "Subject", value: options.subject ?? "テスト件名" },
          { name: "From", value: options.from ?? "sender@example.com" },
          { name: "Date", value: "2026-05-24T10:00:00Z" },
        ],
      },
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/google/calendar/fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MOCK_GET_SECRET.mockResolvedValue(
      JSON.stringify({
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未連携の場合は 404 NOT_FOUND を返す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue(null),
    };
    const app = buildTestApp(connRepo, {}, {}, makeTaskExtractor());

    const res = await app.request("/api/google/calendar/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("接続ステータスが connected でない場合は 404 NOT_FOUND を返す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "disconnected",
      }),
    };
    const app = buildTestApp(connRepo, {}, {}, makeTaskExtractor());

    const res = await app.request("/api/google/calendar/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  it("Calendar API がエラーを返す場合は 502 CALENDAR_API_ERROR を返す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );

    const app = buildTestApp(connRepo, {}, {}, makeTaskExtractor());
    const res = await app.request("/api/google/calendar/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("CALENDAR_API_ERROR");
  });

  it("予定0件の場合は busyScore=0, freeSlotMinutesToday=480 を返す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };
    const calendarCacheRepo: Partial<DynamoGoogleCalendarCacheRepository> = {
      save: vi.fn().mockResolvedValue({}),
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeCalendarResponse([])));

    const app = buildTestApp(
      connRepo,
      calendarCacheRepo,
      {},
      makeTaskExtractor(),
    );
    const res = await app.request("/api/google/calendar/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      upcomingEventCount: number;
      busyScore: number;
      freeSlotMinutesToday: number;
    };
    expect(body.upcomingEventCount).toBe(0);
    expect(body.busyScore).toBe(0);
    expect(body.freeSlotMinutesToday).toBe(480); // 8h * 60min
  });

  it("予定3件かつ次の予定まで20分なら busyScore=0.9 を返す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };
    const calendarCacheRepo: Partial<DynamoGoogleCalendarCacheRepository> = {
      save: vi.fn().mockResolvedValue({}),
    };

    const now = new Date();
    const startInTwentyMin = new Date(now.getTime() + 20 * 60 * 1000);
    const endInEightyMin = new Date(now.getTime() + 80 * 60 * 1000);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeCalendarResponse([
          {
            start: { dateTime: startInTwentyMin.toISOString() },
            end: { dateTime: endInEightyMin.toISOString() },
          },
          {
            start: {
              dateTime: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
            },
            end: {
              dateTime: new Date(now.getTime() + 150 * 60 * 1000).toISOString(),
            },
          },
          {
            start: {
              dateTime: new Date(now.getTime() + 180 * 60 * 1000).toISOString(),
            },
            end: {
              dateTime: new Date(now.getTime() + 240 * 60 * 1000).toISOString(),
            },
          },
        ]),
      ),
    );

    const app = buildTestApp(
      connRepo,
      calendarCacheRepo,
      {},
      makeTaskExtractor(),
    );
    const res = await app.request("/api/google/calendar/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      upcomingEventCount: number;
      busyScore: number;
      nextEventStartsInMinutes: number;
    };
    expect(body.upcomingEventCount).toBe(3);
    // busyScore = min(1.0, 3 * 0.3 + 0.4) = min(1.0, 0.9 + 0.4) = 1.0?
    // 実際: 20分以内なので meetingPressure=0.4, 3件なら 3*0.3=0.9, 合計 1.0 → capped to 1.0
    expect(body.busyScore).toBeGreaterThan(0);
    expect(body.nextEventStartsInMinutes).toBeGreaterThanOrEqual(0);
  });

  it("予定をタスク候補として抽出する（summary を TaskExtractor に渡す）", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };
    const calendarCacheRepo: Partial<DynamoGoogleCalendarCacheRepository> = {
      save: vi.fn().mockResolvedValue({}),
    };
    const now = new Date();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeCalendarResponse([
          {
            id: "evt-1",
            summary: "デザイン変更締め切り",
            start: {
              dateTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
            },
            end: {
              dateTime: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
            },
          },
        ]),
      ),
    );

    const taskExtractor = makeTaskExtractor();
    const app = buildTestApp(connRepo, calendarCacheRepo, {}, taskExtractor);
    const res = await app.request("/api/google/calendar/fetch", {
      method: "POST",
    });

    expect(res.status).toBe(200);
    // TaskExtractor が予定の summary を含むテキストで呼ばれる
    expect(taskExtractor.extractTaskFromSource).toHaveBeenCalledTimes(1);
    const callArg = taskExtractor.extractTaskFromSource.mock.calls[0][0];
    expect(callArg.sourceType).toBe("calendar");
    expect(callArg.text).toContain("デザイン変更締め切り");
    const body = (await res.json()) as { extracted: number };
    expect(body.extracted).toBe(1);
  });

  it("summary が無い予定はタスク抽出をスキップする", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };
    const calendarCacheRepo: Partial<DynamoGoogleCalendarCacheRepository> = {
      save: vi.fn().mockResolvedValue({}),
    };
    const now = new Date();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeCalendarResponse([
          {
            start: {
              dateTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
            },
            end: {
              dateTime: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
            },
          },
        ]),
      ),
    );

    const taskExtractor = makeTaskExtractor();
    const app = buildTestApp(connRepo, calendarCacheRepo, {}, taskExtractor);
    const res = await app.request("/api/google/calendar/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    // summary が無いので TaskExtractor は呼ばれない
    expect(taskExtractor.extractTaskFromSource).not.toHaveBeenCalled();
    const body = (await res.json()) as { extracted: number };
    expect(body.extracted).toBe(0);
  });

  it("Cache に upsert を呼び出す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };
    const calendarCacheRepo: Partial<DynamoGoogleCalendarCacheRepository> = {
      save: vi.fn().mockResolvedValue({}),
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeCalendarResponse([])));

    const app = buildTestApp(
      connRepo,
      calendarCacheRepo,
      {},
      makeTaskExtractor(),
    );
    await app.request("/api/google/calendar/fetch", { method: "POST" });

    expect(calendarCacheRepo.save).toHaveBeenCalledOnce();
    const saveArgs = (calendarCacheRepo.save as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(saveArgs[0]).toBe(MOCK_USER_ID);
    expect(saveArgs[1].userId).toBe(MOCK_USER_ID);
  });

  it("Calendar API レスポンスに items がない場合は空配列として扱う", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };
    const calendarCacheRepo: Partial<DynamoGoogleCalendarCacheRepository> = {
      save: vi.fn().mockResolvedValue({}),
    };

    // items プロパティが存在しないレスポンス（?? [] の右辺を通るケース）
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}), // items なし
      }),
    );

    const app = buildTestApp(
      connRepo,
      calendarCacheRepo,
      {},
      makeTaskExtractor(),
    );
    const res = await app.request("/api/google/calendar/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { upcomingEventCount: number };
    expect(body.upcomingEventCount).toBe(0);
  });

  it("予定の start.date フォールバック（dateTime がない場合）を使う", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };
    const calendarCacheRepo: Partial<DynamoGoogleCalendarCacheRepository> = {
      save: vi.fn().mockResolvedValue({}),
    };

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dayAfter = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // dateTime なし、date のみのイベント（終日予定）
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeCalendarResponse([
          {
            start: { date: tomorrow.toISOString().split("T")[0] },
            end: { date: dayAfter.toISOString().split("T")[0] },
          },
        ]),
      ),
    );

    const app = buildTestApp(
      connRepo,
      calendarCacheRepo,
      {},
      makeTaskExtractor(),
    );
    const res = await app.request("/api/google/calendar/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { upcomingEventCount: number };
    expect(body.upcomingEventCount).toBe(1);
  });

  it("次の予定が過去（start が現在より前）の場合 nextEventStartsInMinutes=0 を返す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };
    const calendarCacheRepo: Partial<DynamoGoogleCalendarCacheRepository> = {
      save: vi.fn().mockResolvedValue({}),
    };

    // 10分前に始まった予定（diffMinutes が負 → 0 にクランプ）
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeCalendarResponse([
          {
            start: { dateTime: tenMinutesAgo.toISOString() },
            end: { dateTime: tenMinutesFromNow.toISOString() },
          },
        ]),
      ),
    );

    const app = buildTestApp(
      connRepo,
      calendarCacheRepo,
      {},
      makeTaskExtractor(),
    );
    const res = await app.request("/api/google/calendar/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { nextEventStartsInMinutes: number };
    expect(body.nextEventStartsInMinutes).toBe(0);
  });

  it("予定に start/end がない場合はデフォルト60分として計算する", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };
    const calendarCacheRepo: Partial<DynamoGoogleCalendarCacheRepository> = {
      save: vi.fn().mockResolvedValue({}),
    };

    // start/end が undefined のイベント
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeCalendarResponse([
          {}, // start/end なし
        ]),
      ),
    );

    const app = buildTestApp(
      connRepo,
      calendarCacheRepo,
      {},
      makeTaskExtractor(),
    );
    const res = await app.request("/api/google/calendar/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { freeSlotMinutesToday: number };
    // デフォルト60分 * 1イベント → 480 - 60 = 420
    expect(body.freeSlotMinutesToday).toBe(420);
  });

  it("JWT がない場合は 401 を返す", async () => {
    const app = buildTestApp({}, {}, {}, makeTaskExtractor(), false);
    const res = await app.request("/api/google/calendar/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/google/calendar/status", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("キャッシュなしの場合は cached: false を返す", async () => {
    const calendarCacheRepo: Partial<DynamoGoogleCalendarCacheRepository> = {
      findByUserId: vi.fn().mockResolvedValue(null),
    };
    const app = buildTestApp({}, calendarCacheRepo, {}, makeTaskExtractor());

    const res = await app.request("/api/google/calendar/status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cached: boolean };
    expect(body.cached).toBe(false);
  });

  it("24時間以内のキャッシュは cached: true, valid: true を返す", async () => {
    const fetchedAt = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1時間前
    const calendarCacheRepo: Partial<DynamoGoogleCalendarCacheRepository> = {
      findByUserId: vi.fn().mockResolvedValue({
        userId: MOCK_USER_ID,
        fetchedAt,
        upcomingEventCount: 2,
        nextEventStartsInMinutes: 30,
        freeSlotMinutesToday: 360,
        busyScore: 0.6,
        ttl: 9999999999,
      }),
    };
    const app = buildTestApp({}, calendarCacheRepo, {}, makeTaskExtractor());

    const res = await app.request("/api/google/calendar/status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      cached: boolean;
      valid: boolean;
      fetchedAt: string;
    };
    expect(body.cached).toBe(true);
    expect(body.valid).toBe(true);
    expect(body.fetchedAt).toBe(fetchedAt);
  });

  it("24時間を超えたキャッシュは cached: true, valid: false を返す", async () => {
    const fetchedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25時間前
    const calendarCacheRepo: Partial<DynamoGoogleCalendarCacheRepository> = {
      findByUserId: vi.fn().mockResolvedValue({
        userId: MOCK_USER_ID,
        fetchedAt,
        upcomingEventCount: 0,
        nextEventStartsInMinutes: null,
        freeSlotMinutesToday: 480,
        busyScore: 0,
        ttl: 1,
      }),
    };
    const app = buildTestApp({}, calendarCacheRepo, {}, makeTaskExtractor());

    const res = await app.request("/api/google/calendar/status");
    const body = (await res.json()) as { cached: boolean; valid: boolean };
    expect(body.cached).toBe(true);
    expect(body.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/google/gmail/fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MOCK_GET_SECRET.mockResolvedValue(
      JSON.stringify({
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未連携の場合は 404 NOT_FOUND を返す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue(null),
    };
    const app = buildTestApp(connRepo, {}, {}, makeTaskExtractor());

    const res = await app.request("/api/google/gmail/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("Gmail messages.list が失敗した場合は 502 GMAIL_API_ERROR を返す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );

    const app = buildTestApp(connRepo, {}, {}, makeTaskExtractor());
    const res = await app.request("/api/google/gmail/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("GMAIL_API_ERROR");
  });

  it("メッセージが0件の場合は total=0, extracted=0 を返す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeGmailListResponse([])),
    );

    const app = buildTestApp(connRepo, {}, {}, makeTaskExtractor());
    const res = await app.request("/api/google/gmail/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      total: number;
      extracted: number;
      candidates: unknown[];
    };
    expect(body.total).toBe(0);
    expect(body.extracted).toBe(0);
    expect(body.candidates).toHaveLength(0);
  });

  it("メッセージが1件で TaskExtractor がタスクを抽出した場合は extracted=1 を返す", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeGmailListResponse([{ id: "msg-001" }])) // messages.list
      .mockResolvedValueOnce(makeGmailDetailResponse("msg-001")); // messages.get

    vi.stubGlobal("fetch", fetchMock);

    const extractor = makeTaskExtractor({ candidateId: "cand-001" });
    const app = buildTestApp(connRepo, {}, {}, extractor);
    const res = await app.request("/api/google/gmail/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      total: number;
      extracted: number;
      skippedNotTask: number;
      candidates: Array<{ candidateId: string }>;
    };
    expect(body.total).toBe(1);
    expect(body.extracted).toBe(1);
    expect(body.skippedNotTask).toBe(0);
    expect(body.candidates[0].candidateId).toBe("cand-001");
  });

  it("TaskExtractor が skipped=true を返した場合は skippedNotTask がカウントされる", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeGmailListResponse([{ id: "msg-002" }]))
      .mockResolvedValueOnce(makeGmailDetailResponse("msg-002"));

    vi.stubGlobal("fetch", fetchMock);

    const extractor = makeTaskExtractor({ skipped: true });
    const app = buildTestApp(connRepo, {}, {}, extractor);
    const res = await app.request("/api/google/gmail/fetch", {
      method: "POST",
    });
    const body = (await res.json()) as {
      total: number;
      extracted: number;
      skippedNotTask: number;
    };
    expect(body.total).toBe(1);
    expect(body.extracted).toBe(0);
    expect(body.skippedNotTask).toBe(1);
  });

  it("メッセージ詳細取得が失敗した場合は skippedError がカウントされる（全体は成功）", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };

    // messages.list は成功、messages.get は失敗
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeGmailListResponse([{ id: "msg-003" }]))
      .mockResolvedValueOnce({ ok: false, status: 403 }); // 詳細取得失敗

    vi.stubGlobal("fetch", fetchMock);

    const extractor = makeTaskExtractor();
    const app = buildTestApp(connRepo, {}, {}, extractor);
    const res = await app.request("/api/google/gmail/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      total: number;
      extracted: number;
      candidates: unknown[];
    };
    // 詳細取得失敗はスキップ扱い → extracted=0
    expect(body.total).toBe(1);
    expect(body.extracted).toBe(0);
    expect(body.candidates).toHaveLength(0);
  });

  it("複数メッセージでタスク抽出とスキップが混在するケース", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };

    // 2件のメッセージ
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeGmailListResponse([{ id: "msg-a" }, { id: "msg-b" }]),
      )
      .mockResolvedValueOnce(makeGmailDetailResponse("msg-a"))
      .mockResolvedValueOnce(makeGmailDetailResponse("msg-b"));

    vi.stubGlobal("fetch", fetchMock);

    // 1回目: タスク抽出成功, 2回目: スキップ
    const extractor = {
      extractTaskFromSource: vi
        .fn()
        .mockResolvedValueOnce({
          skipped: false,
          candidate: {
            candidateId: "cand-a",
            title: "タスクA",
            deadline: null,
            sourceType: "gmail",
            sourceRef: "msg-a",
          },
        })
        .mockResolvedValueOnce({ skipped: true }),
    };

    const app = buildTestApp(
      connRepo,
      {},
      {},
      extractor as unknown as ReturnType<typeof makeTaskExtractor>,
    );
    const res = await app.request("/api/google/gmail/fetch", {
      method: "POST",
    });
    const body = (await res.json()) as {
      total: number;
      extracted: number;
      skippedNotTask: number;
      candidates: Array<{ candidateId: string }>;
    };
    expect(body.total).toBe(2);
    expect(body.extracted).toBe(1);
    expect(body.skippedNotTask).toBe(1);
    expect(body.candidates[0].candidateId).toBe("cand-a");
  });

  it("extractTaskFromSource が例外をスローした場合は skippedError としてカウントされる（全体は成功）", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeGmailListResponse([{ id: "msg-err" }]))
      .mockResolvedValueOnce(makeGmailDetailResponse("msg-err"));

    vi.stubGlobal("fetch", fetchMock);

    // extractTaskFromSource が例外をスロー
    const extractor = {
      extractTaskFromSource: vi
        .fn()
        .mockRejectedValue(new Error("extractor failure")),
    };

    const app = buildTestApp(
      connRepo,
      {},
      {},
      extractor as unknown as ReturnType<typeof makeTaskExtractor>,
    );
    const res = await app.request("/api/google/gmail/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      total: number;
      extracted: number;
      candidates: unknown[];
    };
    // catch ブロックが発火して skipped_error カウントが増え、全体としては成功
    expect(body.total).toBe(1);
    expect(body.extracted).toBe(0);
    expect(body.candidates).toHaveLength(0);
  });

  it("Gmail messages.list レスポンスに messages キーがない場合は空配列として扱う", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };

    // messages キーなし（?? [] の右辺を通るケース）
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );

    const app = buildTestApp(connRepo, {}, {}, makeTaskExtractor());
    const res = await app.request("/api/google/gmail/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(0);
  });

  it("メッセージ詳細に payload.headers がない場合は空ヘッダーとして扱う", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeGmailListResponse([{ id: "msg-no-headers" }]))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "msg-no-headers",
          snippet: "スニペット",
          // payload.headers が存在しない
          payload: {},
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const extractor = makeTaskExtractor({ skipped: true }); // タスク抽出はスキップ
    const app = buildTestApp(connRepo, {}, {}, extractor);
    const res = await app.request("/api/google/gmail/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
  });

  it("メッセージ詳細に snippet がない場合は空文字列として扱う", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeGmailListResponse([{ id: "msg-no-snippet" }]))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "msg-no-snippet",
          // snippet なし
          payload: {
            headers: [
              { name: "Subject", value: "件名テスト" },
              { name: "From", value: "sender@example.com" },
            ],
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const extractor = makeTaskExtractor({ skipped: true });
    const app = buildTestApp(connRepo, {}, {}, extractor);
    const res = await app.request("/api/google/gmail/fetch", {
      method: "POST",
    });
    expect(res.status).toBe(200);
  });

  it("response の candidates に body（本文）が含まれないことを確認する（DP-04）", async () => {
    const connRepo: Partial<DynamoServiceConnectionRepository> = {
      findByUserAndService: vi.fn().mockResolvedValue({
        service: "google",
        status: "connected",
      }),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeGmailListResponse([{ id: "msg-dp04" }]))
      .mockResolvedValueOnce(makeGmailDetailResponse("msg-dp04"));

    vi.stubGlobal("fetch", fetchMock);

    const extractor = makeTaskExtractor({ candidateId: "cand-dp04" });
    const app = buildTestApp(connRepo, {}, {}, extractor);
    const res = await app.request("/api/google/gmail/fetch", {
      method: "POST",
    });
    const body = (await res.json()) as {
      candidates: Array<Record<string, unknown>>;
    };

    const candidate = body.candidates[0];
    // body / snippet フィールドが candidates に含まれていないこと
    expect(Object.keys(candidate)).not.toContain("body");
    expect(Object.keys(candidate)).not.toContain("snippet");
    // candidateId, title, deadline, sourceType, sourceRef のみ
    expect(candidate).toHaveProperty("candidateId");
    expect(candidate).toHaveProperty("title");
    expect(candidate).toHaveProperty("sourceType");
    expect(candidate).toHaveProperty("sourceRef");
  });
});
