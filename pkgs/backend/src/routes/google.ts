/**
 * Google Calendar/Gmail 取り込みルート
 *
 * POST /api/google/calendar/fetch — Google Calendar 手動取り込み（BR-G-03）
 * GET  /api/google/calendar/status — Calendar キャッシュ状態確認
 * POST /api/google/gmail/fetch     — Gmail 手動取り込み（BR-G-04）
 *
 * いずれも認証必須（JWT）。
 * GoogleTokenService でアクセストークンを有効状態に保証する。
 * Gmail メール本文（body）は永続化しない（snippet のみ使用後破棄 — DP-04）。
 * Calendar の予定タイトルは永続化しない（busyScore 等の集計値のみ保存）。
 */

import type { TaskExtractorAgent } from "@saboru/agent";
import { SOURCE_TYPE } from "@saboru/shared";
import { Hono } from "hono";
import { env } from "../config/env.js";
import { getGoogleClientSecret } from "../config/secrets.js";
import { AppError, NotFoundError } from "../errors.js";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoGoogleCalendarCacheRepository } from "../repositories/DynamoGoogleCalendarCacheRepository.js";
import type { DynamoServiceConnectionRepository } from "../repositories/DynamoServiceConnectionRepository.js";
import type { DynamoTaskCandidateRepository } from "../repositories/DynamoTaskCandidateRepository.js";
import { GoogleTokenService } from "../services/GoogleTokenService.js";
import type { AppEnv } from "../types.js";

function logInfo(data: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: "INFO", ...data }));
}

function logError(data: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: "ERROR", ...data }));
}

// Google API endpoints
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const CALENDAR_BASE =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/**
 * busyScore 計算ヒューリスティック（BR-G-03）
 *
 * busyScore = min(1.0, (upcomingEventCount * 0.3) + (nextEventStartsInMinutes < 30 ? 0.4 : 0))
 */
function calcBusyScore(
  upcomingEventCount: number,
  nextEventStartsInMinutes: number | null,
): number {
  const meetingPressure =
    nextEventStartsInMinutes !== null && nextEventStartsInMinutes < 30
      ? 0.4
      : 0;
  return Math.min(1.0, upcomingEventCount * 0.3 + meetingPressure);
}

/**
 * 予定リストから空き時間を推定する（分）
 * 1日 8h 労働を仮定して予定合計時間を引いた値。0 以上。
 */
function estimateFreeSlotMinutes(
  events: Array<{ durationMinutes: number }>,
): number {
  const totalBusyMinutes = events.reduce(
    (sum, e) => sum + e.durationMinutes,
    0,
  );
  return Math.max(0, 8 * 60 - totalBusyMinutes);
}

export function createGoogleRoute(
  connectionRepository: DynamoServiceConnectionRepository,
  calendarCacheRepository: DynamoGoogleCalendarCacheRepository,
  taskCandidateRepository: DynamoTaskCandidateRepository,
  taskExtractorAgent: TaskExtractorAgent,
): Hono<AppEnv> {
  const google = new Hono<AppEnv>();

  google.use("*", authMiddleware);

  // ────────────────────────────────────────────
  // POST /calendar/fetch — Google Calendar 手動取り込み（BR-G-03）
  // ────────────────────────────────────────────
  google.post("/calendar/fetch", async (c) => {
    const userId = c.get("userId");

    // 1. Google 連携済みか確認
    const connection = await connectionRepository.findByUserAndService(
      userId,
      "google",
    );
    if (!connection || connection.status !== "connected") {
      throw new NotFoundError("Google is not connected for this user");
    }

    // 2. アクセストークンを有効状態に保証（BR-G-02）
    const clientSecretArn = env.GOOGLE_CLIENT_SECRET_ARN;
    const clientSecretJson = await getGoogleClientSecret(clientSecretArn);
    const { clientId, clientSecret } = JSON.parse(clientSecretJson) as {
      clientId: string;
      clientSecret: string;
    };
    const tokenService = new GoogleTokenService();
    const secretName = GoogleTokenService.buildSecretName(userId);
    const accessToken = await tokenService.getValidAccessToken(
      userId,
      secretName,
      clientId,
      clientSecret,
    );

    // 3. Google Calendar API v3 events.list を呼び出す
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const calendarUrl = new URL(CALENDAR_BASE);
    calendarUrl.searchParams.set("timeMin", timeMin);
    calendarUrl.searchParams.set("timeMax", timeMax);
    calendarUrl.searchParams.set("maxResults", "20");
    calendarUrl.searchParams.set("singleEvents", "true");
    calendarUrl.searchParams.set("orderBy", "startTime");

    const calResponse = await fetch(calendarUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!calResponse.ok) {
      logError({
        action: "calendar_fetch_failed",
        status: calResponse.status,
        userId,
      });
      throw new AppError(
        502,
        "CALENDAR_API_ERROR",
        "Google Calendar API error",
      );
    }

    const calData = (await calResponse.json()) as {
      items?: Array<{
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
    };

    const items = calData.items ?? [];

    // 4. 予定から集計値を計算（タイトル・説明は保存しない — PII保護）
    const upcomingEventCount = items.length;

    // 次の予定までの分数
    let nextEventStartsInMinutes: number | null = null;
    if (items.length > 0) {
      const firstItem = items[0];
      const startStr = firstItem.start?.dateTime ?? firstItem.start?.date;
      if (startStr) {
        const startMs = new Date(startStr).getTime();
        const diffMinutes = Math.round((startMs - now.getTime()) / 60000);
        nextEventStartsInMinutes = diffMinutes >= 0 ? diffMinutes : 0;
      }
    }

    // 各イベントの所要時間（分）を計算
    const eventsWithDuration = items.map((item) => {
      const startStr = item.start?.dateTime ?? item.start?.date;
      const endStr = item.end?.dateTime ?? item.end?.date;
      let durationMinutes = 60; // デフォルト 60 分
      if (startStr && endStr) {
        const diff = new Date(endStr).getTime() - new Date(startStr).getTime();
        durationMinutes = Math.round(diff / 60000);
      }
      return { durationMinutes };
    });

    const freeSlotMinutesToday = estimateFreeSlotMinutes(eventsWithDuration);
    const busyScore = calcBusyScore(
      upcomingEventCount,
      nextEventStartsInMinutes,
    );

    // 5. GoogleCalendarCache に upsert（TTL=24h）
    const fetchedAt = now.toISOString();
    const ttl = Math.floor(now.getTime() / 1000) + 24 * 60 * 60;

    await calendarCacheRepository.save(userId, {
      userId,
      fetchedAt,
      upcomingEventCount,
      nextEventStartsInMinutes,
      freeSlotMinutesToday,
      busyScore,
      ttl,
    });

    logInfo({
      action: "calendar_fetch_success",
      userId,
      upcomingEventCount,
      busyScore,
    });

    return c.json({
      fetchedAt,
      upcomingEventCount,
      nextEventStartsInMinutes,
      freeSlotMinutesToday,
      busyScore,
    });
  });

  // ────────────────────────────────────────────
  // GET /calendar/status — Calendar キャッシュ状態確認
  // ────────────────────────────────────────────
  google.get("/calendar/status", async (c) => {
    const userId = c.get("userId");

    const cache = await calendarCacheRepository.findByUserId(userId);

    if (!cache) {
      return c.json({ cached: false });
    }

    // 24h以内かチェック
    const fetchedAtMs = new Date(cache.fetchedAt).getTime();
    const isValid = Date.now() - fetchedAtMs < 24 * 60 * 60 * 1000;

    return c.json({
      cached: true,
      valid: isValid,
      fetchedAt: cache.fetchedAt,
      upcomingEventCount: cache.upcomingEventCount,
      nextEventStartsInMinutes: cache.nextEventStartsInMinutes,
      freeSlotMinutesToday: cache.freeSlotMinutesToday,
      busyScore: cache.busyScore,
    });
  });

  // ────────────────────────────────────────────
  // POST /gmail/fetch — Gmail 手動取り込み（BR-G-04）
  // ────────────────────────────────────────────
  google.post("/gmail/fetch", async (c) => {
    const userId = c.get("userId");

    // 1. Google 連携済みか確認
    const connection = await connectionRepository.findByUserAndService(
      userId,
      "google",
    );
    if (!connection || connection.status !== "connected") {
      throw new NotFoundError("Google is not connected for this user");
    }

    // 2. アクセストークンを有効状態に保証（BR-G-02）
    const clientSecretArn = env.GOOGLE_CLIENT_SECRET_ARN;
    const clientSecretJson = await getGoogleClientSecret(clientSecretArn);
    const { clientId, clientSecret } = JSON.parse(clientSecretJson) as {
      clientId: string;
      clientSecret: string;
    };
    const tokenService = new GoogleTokenService();
    const secretName = GoogleTokenService.buildSecretName(userId);
    const accessToken = await tokenService.getValidAccessToken(
      userId,
      secretName,
      clientId,
      clientSecret,
    );

    // 3. Gmail API messages.list（直近7日・未読・最大50件）
    const listUrl = new URL(`${GMAIL_BASE}/messages`);
    listUrl.searchParams.set("q", "newer_than:7d is:unread");
    listUrl.searchParams.set("maxResults", "50");

    const listResponse = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listResponse.ok) {
      logError({
        action: "gmail_list_failed",
        status: listResponse.status,
        userId,
      });
      throw new AppError(
        502,
        "GMAIL_API_ERROR",
        "Gmail API error on messages.list",
      );
    }

    const listData = (await listResponse.json()) as {
      messages?: Array<{ id: string }>;
    };

    const messages = listData.messages ?? [];

    logInfo({
      action: "gmail_list_fetched",
      userId,
      count: messages.length,
    });

    // 4. 各メッセージの Subject/From/Date + snippet を取得してタスク抽出
    const extractedCandidates = [];
    const skippedCount = { notTask: 0, error: 0 };

    for (const msg of messages) {
      try {
        const detailUrl = new URL(`${GMAIL_BASE}/messages/${msg.id}`);
        detailUrl.searchParams.set("format", "metadata");
        detailUrl.searchParams.set("metadataHeaders", "Subject");
        detailUrl.searchParams.set("metadataHeaders", "From");
        detailUrl.searchParams.set("metadataHeaders", "Date");

        const detailResponse = await fetch(detailUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!detailResponse.ok) {
          skippedCount.error++;
          continue;
        }

        const detail = (await detailResponse.json()) as {
          id: string;
          snippet?: string;
          payload?: {
            headers?: Array<{ name: string; value: string }>;
          };
        };

        // ヘッダーから Subject / From を取得
        const headers = detail.payload?.headers ?? [];
        const getHeader = (name: string): string =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
            ?.value ?? "";

        const subject = getHeader("Subject");
        const from = getHeader("From");
        const snippet = detail.snippet ?? "";

        // 入力テキストを組み立て（件名 + 送信者 + snippet）
        // raw 本文（body）は取得・永続化しない（DP-04）
        const inputText = [
          `件名: ${subject}`,
          `送信者: ${from}`,
          `内容: ${snippet}`,
        ]
          .filter((line) => line.split(": ")[1]?.trim())
          .join("\n");

        // 5. 汎用化した TaskExtractor に渡す（sourceType="gmail", sourceRef=messageId）
        const result = await taskExtractorAgent.extractTaskFromSource({
          userId,
          text: inputText,
          sourceType: SOURCE_TYPE.GMAIL,
          sourceRef: detail.id,
          requesterHint: from,
        });

        if (!result.skipped) {
          extractedCandidates.push(result.candidate);
        } else {
          skippedCount.notTask++;
        }

        // inputText はここでスコープ外になる（DP-04: raw 情報の破棄）
      } catch (err) {
        logError({
          action: "gmail_message_process_error",
          messageId: msg.id,
          err,
        });
        skippedCount.error++;
      }
    }

    logInfo({
      action: "gmail_fetch_complete",
      userId,
      total: messages.length,
      extracted: extractedCandidates.length,
      skipped_not_task: skippedCount.notTask,
      skipped_error: skippedCount.error,
    });

    return c.json({
      total: messages.length,
      extracted: extractedCandidates.length,
      skippedNotTask: skippedCount.notTask,
      candidates: extractedCandidates.map((c) => ({
        candidateId: c.candidateId,
        title: c.title,
        deadline: c.deadline,
        sourceType: c.sourceType,
        sourceRef: c.sourceRef,
      })),
    });
  });

  return google;
}
