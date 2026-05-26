/**
 * CalendarTimeslotService — Google Calendar 予定の時間区間（busy slot）取得サービス（U-G02）
 *
 * 3 バンドガントチャート機能のため、Google Calendar の予定を
 * 「時間区間（busy slot）」として取得する。
 *
 * PII 保護方針（DP-04 踏襲）:
 * - 予定タイトル（summary）・説明は一切読まない・保持しない・永続化しない。
 * - 開始/終了時刻（startAt / endAt）のみを返す。
 *
 * 設計:
 * - アクセストークンは呼び出し元（route）が GoogleTokenService で取得して渡す。
 *   本サービス自体は GoogleTokenService に依存しない（accessToken を引数で受ける）。
 * - 揮発データ。生成のたびに「今この瞬間のカレンダー状況」に基づいて取得する。
 */

import type { BusySlot } from "@saboru/shared";
import { AppError } from "../errors.js";
import { fetchWithTimeout } from "../utils/fetchWithTimeout.js";

function logInfo(data: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: "INFO", ...data }));
}

function logError(data: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: "ERROR", ...data }));
}

/** Google Calendar API v3 events.list エンドポイント（primary カレンダー） */
const CALENDAR_BASE =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** 1 回の取得で読む予定の最大件数 */
const MAX_RESULTS = 20;

/**
 * 終日予定（date のみ）の 1 日を ISO 8601 の時間区間に変換する。
 * startAt はその日の 0 時、endAt は翌日の 0 時（= 当日 24 時）とする。
 *
 * @param dateStr - "YYYY-MM-DD" 形式の日付文字列
 * @returns startAt / endAt の ISO 文字列。パースできない場合は null
 */
function allDayDateToSlot(
  dateStr: string,
): { startAt: string; endAt: string } | null {
  const startMs = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  if (Number.isNaN(startMs)) {
    return null;
  }
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return {
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
  };
}

/**
 * 予定 1 件の start / end から BusySlot を算出する。
 * dateTime（時刻あり）を優先し、なければ date（終日）を時間区間化する。
 * start / end のいずれかが取れない予定は null（呼び出し側でスキップ）。
 */
function toBusySlot(item: {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}): BusySlot | null {
  // dateTime（時刻あり）を最優先で採用する
  const startDateTime = item.start?.dateTime;
  const endDateTime = item.end?.dateTime;
  if (startDateTime && endDateTime) {
    return { startAt: startDateTime, endAt: endDateTime };
  }

  // 終日予定（date のみ）を時間区間に変換する
  const startDate = item.start?.date;
  const endDate = item.end?.date;
  if (startDate && endDate) {
    const startSlot = allDayDateToSlot(startDate);
    const endSlot = allDayDateToSlot(endDate);
    if (startSlot && endSlot) {
      // 終了日（exclusive な date）も 0 時起点で扱う。
      // 単日終日予定は start=当日0時, end=翌日0時 のように Google が返すため、
      // start の startAt と end の startAt をそのまま使う。
      return { startAt: startSlot.startAt, endAt: endSlot.startAt };
    }
  }

  // dateTime と date が混在する（片方しか取れない）場合のフォールバック
  const startStr = startDateTime ?? startDate;
  const endStr = endDateTime ?? endDate;
  if (startStr && endStr) {
    const startMs = startDateTime
      ? new Date(startStr).getTime()
      : new Date(`${startStr}T00:00:00.000Z`).getTime();
    const endMs = endDateTime
      ? new Date(endStr).getTime()
      : new Date(`${endStr}T00:00:00.000Z`).getTime();
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
      return {
        startAt: new Date(startMs).toISOString(),
        endAt: new Date(endMs).toISOString(),
      };
    }
  }

  return null;
}

/**
 * CalendarTimeslotService — Google Calendar の予定を busy slot 配列として取得する。
 */
export class CalendarTimeslotService {
  /**
   * 指定ウィンドウ内の予定を時間区間（busy slot）として取得する。
   *
   * 予定タイトル・説明は読み取らず、開始/終了時刻のみを返す（PII 保護 / DP-04）。
   *
   * @param params.accessToken   - 有効な Google アクセストークン（route 側で取得済み）
   * @param params.windowStartAt - 取得ウィンドウ開始（ISO 8601） → timeMin
   * @param params.windowEndAt   - 取得ウィンドウ終了（ISO 8601） → timeMax
   * @returns BusySlot 配列（start/end が取れない予定はスキップ）
   * @throws AppError(502, "CALENDAR_API_ERROR") — Google Calendar API がエラー応答した場合
   */
  async fetchBusySlots(params: {
    accessToken: string;
    windowStartAt: string;
    windowEndAt: string;
  }): Promise<BusySlot[]> {
    const { accessToken, windowStartAt, windowEndAt } = params;

    const calendarUrl = new URL(CALENDAR_BASE);
    calendarUrl.searchParams.set("timeMin", windowStartAt);
    calendarUrl.searchParams.set("timeMax", windowEndAt);
    calendarUrl.searchParams.set("maxResults", String(MAX_RESULTS));
    calendarUrl.searchParams.set("singleEvents", "true");
    calendarUrl.searchParams.set("orderBy", "startTime");

    const response = await fetchWithTimeout(calendarUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      logError({
        action: "calendar_busy_slots_fetch_failed",
        status: response.status,
      });
      throw new AppError(
        502,
        "CALENDAR_API_ERROR",
        "Google Calendar API error",
      );
    }

    // items の start/end のみを参照する。summary / description は読まない（PII 保護）。
    const data = (await response.json()) as {
      items?: Array<{
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
    };

    const items = data.items ?? [];

    const slots: BusySlot[] = [];
    for (const item of items) {
      const slot = toBusySlot(item);
      if (slot) {
        slots.push(slot);
      }
    }

    logInfo({
      action: "calendar_busy_slots_fetched",
      total: items.length,
      slots: slots.length,
    });

    return slots;
  }
}
