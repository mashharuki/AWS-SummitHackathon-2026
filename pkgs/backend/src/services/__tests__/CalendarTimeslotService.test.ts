/**
 * CalendarTimeslotService のテスト（U-G02）
 *
 * テスト内容:
 * - 正常系: dateTime 形式の予定2件 → busy slot 2件返る
 * - 終日予定（date only）の時間区間変換
 * - start / end 欠損予定のスキップ
 * - HTTP エラー → AppError(502, CALENDAR_API_ERROR) を投げる
 * - PII 保護: summary を含めても返り値に含まれない（タイトルを読んでいない）
 *
 * global fetch は vi.stubGlobal でモックする（既存テスト踏襲）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../errors.js";
import { CalendarTimeslotService } from "../CalendarTimeslotService.js";

const ACCESS_TOKEN = "test-access-token";
const WINDOW_START = "2026-05-25T00:00:00.000Z";
const WINDOW_END = "2026-05-26T00:00:00.000Z";

type CalendarItem = {
  // summary を含めても返り値に出てこないことを検証するため任意で受ける
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

/** Google Calendar API v3 events.list の正常レスポンスを作る */
function makeCalendarResponse(items: CalendarItem[] = []) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items }),
  };
}

function callFetchBusySlots() {
  const service = new CalendarTimeslotService();
  return service.fetchBusySlots({
    accessToken: ACCESS_TOKEN,
    windowStartAt: WINDOW_START,
    windowEndAt: WINDOW_END,
  });
}

describe("CalendarTimeslotService.fetchBusySlots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常系: dateTime 形式の予定2件 → busy slot 2件を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeCalendarResponse([
          {
            start: { dateTime: "2026-05-25T09:00:00.000Z" },
            end: { dateTime: "2026-05-25T10:00:00.000Z" },
          },
          {
            start: { dateTime: "2026-05-25T13:00:00.000Z" },
            end: { dateTime: "2026-05-25T14:30:00.000Z" },
          },
        ]),
      ),
    );

    const slots = await callFetchBusySlots();

    expect(slots).toHaveLength(2);
    expect(slots[0]).toEqual({
      startAt: "2026-05-25T09:00:00.000Z",
      endAt: "2026-05-25T10:00:00.000Z",
    });
    expect(slots[1]).toEqual({
      startAt: "2026-05-25T13:00:00.000Z",
      endAt: "2026-05-25T14:30:00.000Z",
    });
  });

  it("正しいクエリパラメータと Authorization ヘッダーで Calendar API を呼ぶ", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeCalendarResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await callFetchBusySlots();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(calledUrl);
    expect(url.origin + url.pathname).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    );
    expect(url.searchParams.get("timeMin")).toBe(WINDOW_START);
    expect(url.searchParams.get("timeMax")).toBe(WINDOW_END);
    expect(url.searchParams.get("maxResults")).toBe("20");
    expect(url.searchParams.get("singleEvents")).toBe("true");
    expect(url.searchParams.get("orderBy")).toBe("startTime");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${ACCESS_TOKEN}`,
    );
  });

  it("終日予定（date only）を 0時〜翌0時の時間区間に変換する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeCalendarResponse([
          {
            // 単日終日予定: Google は end.date を翌日（exclusive）で返す
            start: { date: "2026-05-25" },
            end: { date: "2026-05-26" },
          },
        ]),
      ),
    );

    const slots = await callFetchBusySlots();

    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual({
      startAt: "2026-05-25T00:00:00.000Z",
      endAt: "2026-05-26T00:00:00.000Z",
    });
  });

  it("start / end が欠損した予定はスキップする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeCalendarResponse([
          // start も end も無い → スキップ
          {},
          // start だけある（end 欠損）→ スキップ
          { start: { dateTime: "2026-05-25T09:00:00.000Z" } },
          // end だけある（start 欠損）→ スキップ
          { end: { dateTime: "2026-05-25T10:00:00.000Z" } },
          // 両方ある → 採用
          {
            start: { dateTime: "2026-05-25T15:00:00.000Z" },
            end: { dateTime: "2026-05-25T16:00:00.000Z" },
          },
        ]),
      ),
    );

    const slots = await callFetchBusySlots();

    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual({
      startAt: "2026-05-25T15:00:00.000Z",
      endAt: "2026-05-25T16:00:00.000Z",
    });
  });

  it("HTTP エラー応答時は AppError(502, CALENDAR_API_ERROR) を投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );

    await expect(callFetchBusySlots()).rejects.toThrowError(AppError);
    await expect(callFetchBusySlots()).rejects.toMatchObject({
      statusCode: 502,
      code: "CALENDAR_API_ERROR",
    });
  });

  it("PII 保護: summary / description を含むレスポンスでも返り値に含まれない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeCalendarResponse([
          {
            summary: "機密プロジェクト定例（秘密のタイトル）",
            description: "顧客名や個人情報を含む説明文",
            start: { dateTime: "2026-05-25T09:00:00.000Z" },
            end: { dateTime: "2026-05-25T10:00:00.000Z" },
          },
        ]),
      ),
    );

    const slots = await callFetchBusySlots();

    expect(slots).toHaveLength(1);
    // 返り値は startAt / endAt の 2 キーのみ（PII フィールドが漏れていない）
    expect(Object.keys(slots[0]).sort()).toEqual(["endAt", "startAt"]);

    // 念のためシリアライズ後にもタイトル・説明が含まれないことを確認
    const serialized = JSON.stringify(slots);
    expect(serialized).not.toContain("秘密のタイトル");
    expect(serialized).not.toContain("個人情報");
    expect(serialized).not.toContain("summary");
    expect(serialized).not.toContain("description");
  });
});
