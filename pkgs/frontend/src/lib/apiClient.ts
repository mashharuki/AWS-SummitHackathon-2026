/**
 * APIクライアント — U-04 api の14エンドポイントに対応
 * NFR-DESIGN-8: 認証ヘッダー自動付与 + 401時トークンリフレッシュ
 * NFR-DESIGN-10: カスタム API エラー型
 */
import type {
  Proposal,
  ServiceConnection,
  Task,
  TaskCandidate,
  User,
} from "@saboru/shared";
import {
  clearTokens,
  getApiAuthToken,
  refreshAccessToken,
  setAccessToken,
} from "./cognito";
import { getRuntimeConfig } from "./runtimeConfig.js";

function getApiBaseUrl(): string {
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

let _refreshPromise: Promise<string | null> | null = null;

/** NFR-DESIGN-8: 認証付きリクエスト（401時はリフレッシュ + 1回リトライ） */
async function request<T>(
  path: string,
  options?: RequestInit,
  retry = true,
): Promise<T> {
  // API Gateway JWT オーソライザーには id_token を送る（name/email クレームを含む）
  const token = getApiAuthToken();

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
    if (!_refreshPromise) {
      _refreshPromise = refreshAccessToken().finally(() => {
        _refreshPromise = null;
      });
    }
    const newToken = await _refreshPromise;
    if (newToken) {
      setAccessToken(newToken);
      return request<T>(path, options, false);
    }
    // リフレッシュ失敗 → ログアウト
    clearTokens();
    window.location.href = "/login";
    throw new ApiError(401, null);
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

/** POST /api/tasks/candidates/:id/approve */
export async function approveCandidate(candidateId: string): Promise<Task> {
  return request<Task>(`/api/tasks/candidates/${candidateId}/approve`, {
    method: "POST",
  });
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

export default {
  getMe,
  getDependencyScore,
  decrementDependencyScore,
  getHonneSummary,
  updatePersona,
  getCandidates,
  approveCandidate,
  rejectCandidate,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
  createTask,
  getProposal,
  submitHonne,
  getConnections,
  getSlackAuthUrl,
  getSlackChannels,
  syncSlackMessages,
  notifyTaskToSlack,
  disconnectService,
  buildProposalStreamUrl,
};
