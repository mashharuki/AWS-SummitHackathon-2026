/**
 * APIクライアント — U-04 api の14エンドポイントに対応
 * NFR-DESIGN-8: 認証ヘッダー自動付与 + 401時トークンリフレッシュ
 * NFR-DESIGN-10: カスタム API エラー型
 */
import type {
  Proposal,
  SaboriSchedule,
  ScheduleApiResponse,
  ScheduleStep,
  ServiceConnection,
  Task,
  TaskCandidate,
  User,
} from "@saboru/shared";
import {
  clearTokens,
  getApiAuthToken,
  getRefreshToken,
  refreshAccessToken,
} from "./cognito";
import { getRuntimeConfig } from "./runtimeConfig.js";

function getApiBaseUrl(): string {
  /* v8 ignore next */
  return getRuntimeConfig("VITE_API_BASE_URL") || "http://localhost:3000";
}

/** APIエラー型 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API Error: ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  isUnauthorized() {
    return this.status === 401;
  }
  isNotFound() {
    return this.status === 404;
  }
  isServerError() {
    return this.status >= 500;
  }
}

/**
 * スロットリング（Lambda 同時実行上限超過）対策の自動リトライ設定。
 *
 * デモ環境は Lambda 同時実行上限が小さく、初回ロードで複数 GET が並列に
 * 集中すると一時的に 429/503 が返ることがある。ユーザーにエラーを見せず、
 * 短い指数バックオフ + ジッタで静かに再試行して吸収する。
 * 副作用のある書き込み（GET 以外）は安全側で自動リトライしない。
 */
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);
const MAX_TRANSIENT_RETRIES = 3;
const BASE_BACKOFF_MS = 250;

function isTransientStatus(status: number): boolean {
  return TRANSIENT_STATUSES.has(status);
}

/** GET（またはメソッド未指定＝GET）のみ自動リトライ対象とする。 */
function isRetryableMethod(options?: RequestInit): boolean {
  const method = (options?.method ?? "GET").toUpperCase();
  return method === "GET";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 指数バックオフ + ジッタ（attempt は 0 始まり）。 */
function backoffDelayMs(attempt: number): number {
  const expo = BASE_BACKOFF_MS * 2 ** attempt;
  return expo + Math.random() * BASE_BACKOFF_MS;
}

let _refreshPromise: Promise<string | null> | null = null;

/** 同時多発リクエストでも refresh は一度だけ走らせる（重複リフレッシュ防止） */
function refreshOnce(): Promise<string | null> {
  if (!_refreshPromise) {
    _refreshPromise = refreshAccessToken().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
}

/**
 * NFR-DESIGN-8: 認証付きリクエスト。
 * - 401: リフレッシュ + 1回リトライ
 * - 429/502/503/504（GET のみ）: 指数バックオフで最大 MAX_TRANSIENT_RETRIES 回リトライ
 */
async function request<T>(
  path: string,
  options?: RequestInit,
  retry = true,
  transientAttempt = 0,
): Promise<T> {
  // API Gateway JWT オーソライザーには id_token を送る（name/email クレームを含む）
  let token = getApiAuthToken();

  // トークンがメモリに無い場合（リロード直後など）、ヘッダー無しで送ると
  // API Gateway の JWT オーソライザーに必ず 401 で弾かれる。
  // refresh_token があるなら先にリフレッシュしてからトークンを載せる。
  // （AuthProvider のトークン復元と本リクエストのレース対策）
  if (!token && retry && getRefreshToken()) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      token = getApiAuthToken();
    }
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers ?? {}),
  };

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry) {
    // refreshAccessToken は内部で id/access 両トークンを更新する。
    // ここで個別に setAccessToken する必要はない（getApiAuthToken が更新後の id_token を返す）。
    const newToken = await refreshOnce();
    /* v8 ignore next */
    if (newToken) {
      return request<T>(path, options, false);
    }
    // リフレッシュ失敗 → ログアウト
    clearTokens();
    window.location.href = "/login";
    throw new ApiError(401, null);
  }

  // スロットリング等の一時エラー: GET のみ静かに指数バックオフでリトライする。
  // 上限に達したら通常通り ApiError を投げる（呼び出し側のフォールバックに委ねる）。
  if (
    isTransientStatus(res.status) &&
    isRetryableMethod(options) &&
    transientAttempt < MAX_TRANSIENT_RETRIES
  ) {
    await sleep(backoffDelayMs(transientAttempt));
    return request<T>(path, options, retry, transientAttempt + 1);
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(res.status, body);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// --- ユーザー ---

/** GET /api/users/me */
export async function getMe(): Promise<User> {
  return request<User>("/api/users/me");
}

/** GET /api/users/me/dependency-score */
export async function getDependencyScore(): Promise<{ score: number }> {
  return request<{ score: number }>("/api/users/me/dependency-score");
}

/** POST /api/users/me/dependency-score/decrement */
export async function decrementDependencyScore(
  delta: number,
): Promise<{ score: number }> {
  return request<{ score: number }>(
    "/api/users/me/dependency-score/decrement",
    {
      method: "POST",
      body: JSON.stringify({ delta }),
    },
  );
}

export interface HonneSummary {
  count: number;
  quickReplyBreakdown: {
    agree_with_ai: number;
    truly_tired: number;
    disagree_with_ai: number;
    actually_important: number;
  };
  recentFreeTexts: string[];
}

/** GET /api/users/me/honne/summary */
export async function getHonneSummary(): Promise<HonneSummary> {
  return request<HonneSummary>("/api/users/me/honne/summary");
}

/** PUT /api/users/me/persona — 好みの AI ペルソナを更新 */
export async function updatePersona(personaId: string): Promise<User> {
  return request<User>("/api/users/me/persona", {
    method: "PUT",
    body: JSON.stringify({ personaId }),
  });
}

// --- タスク候補 ---

/** GET /api/tasks/candidates */
export async function getCandidates(): Promise<TaskCandidate[]> {
  const data = await request<{ candidates: TaskCandidate[] }>(
    "/api/tasks/candidates",
  );
  return data.candidates;
}

/** 承認モーダルでユーザーが編集した内容（候補の値を上書きする） */
export interface ApproveOverridesPayload {
  title?: string;
  deadline?: string | null;
  description?: string;
  plannedSteps?: ScheduleStep[];
}

/**
 * POST /api/tasks/candidates/:id/approve
 *
 * overrides を渡すと、承認モーダルで確認・編集した内容で Task を生成する。
 * 省略時は候補の元値で承認（後方互換）。
 */
export async function approveCandidate(
  candidateId: string,
  overrides?: ApproveOverridesPayload,
): Promise<Task> {
  return request<Task>(`/api/tasks/candidates/${candidateId}/approve`, {
    method: "POST",
    ...(overrides ? { body: JSON.stringify({ overrides }) } : {}),
  });
}

/**
 * POST /api/tasks/candidates/:id/plan-steps
 *
 * 承認モーダルを開いたときに呼ぶ。Bedrock で「やること」（作業ステップ）の
 * 下書きを生成して返す。失敗時は ApiError（503 など）を投げる。
 */
export async function fetchPlanSteps(
  candidateId: string,
): Promise<ScheduleStep[]> {
  const data = await request<{ steps: ScheduleStep[] }>(
    `/api/tasks/candidates/${candidateId}/plan-steps`,
    { method: "POST" },
  );
  return data.steps;
}

/** DELETE /api/tasks/candidates/:id */
export async function rejectCandidate(candidateId: string): Promise<void> {
  return request<void>(`/api/tasks/candidates/${candidateId}`, {
    method: "DELETE",
  });
}

// --- タスク ---

/** GET /api/tasks */
export async function getTasks(): Promise<Task[]> {
  const data = await request<{ tasks: Task[] }>("/api/tasks");
  return data.tasks;
}

/** GET /api/tasks/:id */
export async function getTask(taskId: string): Promise<Task> {
  return request<Task>(`/api/tasks/${taskId}`);
}

/** PATCH /api/tasks/:id */
export async function updateTask(
  taskId: string,
  data: { title?: string; deadline?: string | null; description?: string },
): Promise<Task> {
  return request<Task>(`/api/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** DELETE /api/tasks/:id */
export async function deleteTask(taskId: string): Promise<void> {
  return request<void>(`/api/tasks/${taskId}`, {
    method: "DELETE",
  });
}

/**
 * PATCH /api/tasks/:taskId/planned-steps
 *
 * ガントUI のドラッグ/リサイズ編集結果を永続化する。
 * plannedSteps 全体を上書きする（1〜8件）。
 * decision ステップは decisionAt 必須（サーバ側でも検証）。
 *
 * @returns 更新後の Task
 */
export async function updatePlannedSteps(
  taskId: string,
  plannedSteps: ScheduleStep[],
): Promise<Task> {
  return request<Task>(`/api/tasks/${taskId}/planned-steps`, {
    method: "PATCH",
    body: JSON.stringify({ plannedSteps }),
  });
}

/** POST /api/tasks (手動登録) */
export async function createTask(data: {
  title: string;
  deadline?: string | null;
  description?: string;
}): Promise<Task> {
  return request<Task>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- 提案 ---

/** GET /api/tasks/:id/proposal（最新提案取得） */
export async function getProposal(taskId: string): Promise<Proposal | null> {
  try {
    return await request<Proposal>(`/api/tasks/${taskId}/proposal`);
  } catch (err) {
    if (err instanceof ApiError && err.isNotFound()) return null;
    throw err;
  }
}

/** GET /api/tasks/:id/schedule（3バンドガント用スケジュール取得） */
export async function getSchedule(
  taskId: string,
): Promise<SaboriSchedule | null> {
  try {
    const res = await request<ScheduleApiResponse>(
      `/api/tasks/${taskId}/schedule`,
    );
    return res.schedule;
  } catch (err) {
    if (err instanceof ApiError && err.isNotFound()) return null;
    throw err;
  }
}

/** POST /api/tasks/:id/honne（本音フィードバック送信） */
export async function submitHonne(
  taskId: string,
  data: { type: "quick_reply" | "free_text"; content: string },
): Promise<void> {
  return request<void>(`/api/tasks/${taskId}/honne`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- 接続 ---

/** GET /api/connections */
export async function getConnections(): Promise<ServiceConnection[]> {
  const data = await request<{ connections: ServiceConnection[] }>(
    "/api/connections",
  );
  return data.connections;
}

/**
 * GET /api/auth/slack — Slack OAuth 認可 URL を取得する
 * （認証ヘッダ付き fetch。返ってきた url へフロントが遷移して連携を開始する）
 */
export async function getSlackAuthUrl(): Promise<string> {
  const data = await request<{ url: string }>("/api/auth/slack");
  return data.url;
}

/** Bot が参加している Slack チャンネル */
export interface SlackChannelOption {
  id: string;
  name: string;
}

/** GET /api/slack/channels — Bot 参加チャンネル一覧 */
export async function getSlackChannels(): Promise<SlackChannelOption[]> {
  const data = await request<{ channels: SlackChannelOption[] }>(
    "/api/slack/channels",
  );
  return data.channels;
}

/** POST /api/slack/sync-messages — Slack 履歴を遡及取得してタスク化 */
export async function syncSlackMessages(
  channelId: string,
): Promise<{ scanned: number; queued: number }> {
  return request("/api/slack/sync-messages", {
    method: "POST",
    body: JSON.stringify({ channelId }),
  });
}

/** POST /api/slack/notify-task — タスクの判定を Slack に投稿 */
export async function notifyTaskToSlack(
  taskId: string,
  channelId: string,
): Promise<{ posted: boolean; verdict: string }> {
  return request("/api/slack/notify-task", {
    method: "POST",
    body: JSON.stringify({ taskId, channelId }),
  });
}

/** DELETE /api/connections/:service */
export async function disconnectService(service: string): Promise<void> {
  return request<void>(`/api/connections/${service}`, {
    method: "DELETE",
  });
}

/** 提案ストリーミング用 SSE URL を構築 (GET /api/tasks/:id/proposal?stream=true)
 * トークンは Authorization ヘッダーで送信するため URL に含めない (FE-C-1)
 */
export function buildProposalStreamUrl(taskId: string): string {
  return `${getApiBaseUrl()}/api/tasks/${taskId}/proposal?stream=true`;
}

// --- Google OAuth ---

/**
 * GET /api/auth/google — Google OAuth 認可 URL を取得する
 * （認証ヘッダ付き fetch。返ってきた url へフロントが遷移して連携を開始する）
 */
export async function getGoogleAuthUrl(): Promise<string> {
  const data = await request<{ url: string }>("/api/auth/google");
  return data.url;
}

/**
 * DELETE /api/auth/google — Google 連携解除
 */
export async function disconnectGoogle(): Promise<void> {
  return request<void>("/api/auth/google", {
    method: "DELETE",
  });
}

/**
 * Google Calendar 取り込みレスポンス型
 */
export interface CalendarFetchResponse {
  fetchedAt: string;
  upcomingEventCount: number;
  nextEventStartsInMinutes: number | null;
  freeSlotMinutesToday: number;
  busyScore: number;
}

/**
 * Google Calendar キャッシュ状態レスポンス型
 */
export interface CalendarStatusResponse {
  cached: boolean;
  valid?: boolean;
  fetchedAt?: string;
  upcomingEventCount?: number;
  nextEventStartsInMinutes?: number | null;
  freeSlotMinutesToday?: number;
  busyScore?: number;
}

/**
 * Gmail 取り込みレスポンス型
 */
export interface GmailFetchResponse {
  total: number;
  extracted: number;
  skippedNotTask: number;
  candidates: Array<{
    candidateId: string;
    title: string;
    deadline: string | null;
    sourceType: string;
    sourceRef: string;
  }>;
}

/**
 * POST /api/google/calendar/fetch — Google Calendar 手動取り込み
 */
export async function fetchGoogleCalendar(): Promise<CalendarFetchResponse> {
  return request<CalendarFetchResponse>("/api/google/calendar/fetch", {
    method: "POST",
  });
}

/**
 * GET /api/google/calendar/status — Calendar キャッシュ状態確認
 */
export async function getCalendarStatus(): Promise<CalendarStatusResponse> {
  return request<CalendarStatusResponse>("/api/google/calendar/status");
}

/**
 * POST /api/google/gmail/fetch — Gmail 手動取り込み
 */
export async function fetchGmail(): Promise<GmailFetchResponse> {
  return request<GmailFetchResponse>("/api/google/gmail/fetch", {
    method: "POST",
  });
}

export default {
  getMe,
  getDependencyScore,
  decrementDependencyScore,
  getHonneSummary,
  updatePersona,
  getCandidates,
  approveCandidate,
  fetchPlanSteps,
  rejectCandidate,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
  createTask,
  updatePlannedSteps,
  getProposal,
  getSchedule,
  submitHonne,
  getConnections,
  getSlackAuthUrl,
  getSlackChannels,
  syncSlackMessages,
  notifyTaskToSlack,
  disconnectService,
  buildProposalStreamUrl,
  getGoogleAuthUrl,
  disconnectGoogle,
  fetchGoogleCalendar,
  getCalendarStatus,
  fetchGmail,
};
