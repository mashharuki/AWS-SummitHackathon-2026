/**
 * Agent client: abstraction layer for calling the backend API.
 *
 * Primary path: ElevenLabs Dashboard remote MCP registration (external;
 *   see ELEVENLABS_MCP_SETUP.md). The extension does not proxy MCP calls —
 *   ElevenLabs calls the SABOROU backend via streamable_http directly.
 *
 * Fallback path: Hono API direct call (VITE_API_URL).
 *   This module implements the "client_tools_fallback" / "hono_direct_fallback"
 *   paths used when the extension registers tool callbacks as ElevenLabs
 *   clientTools. All functions in this module always call Hono API directly.
 *
 * API keys are never held in the extension. All requests carry the
 * Cognito JWT from getValidToken() in the Authorization header.
 */

// ---------------------------------------------------------------------------
// Re-exports from mcpFallback for backward compatibility
// ---------------------------------------------------------------------------

export {
  getMcpFallbackMode,
  getSafeConfigView,
  getMcpToolsBaseUrl,
  type FallbackMode,
} from "./mcpFallback";

import type {
  CalendarStatus,
  GoalAnalysis,
  ProgressReport,
  Proposal,
  SaboriSchedule,
  ScheduleStep,
  SubTaskStatus,
  TaskCandidate,
  TaskSummary,
} from "./types";

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export function getApiUrl(): string {
  const v = import.meta.env.VITE_API_URL;
  if (!v || v === "undefined" || v === "null") {
    return "https://api.saborou.example.com";
  }
  return v;
}

/**
 * Returns true when the MCP tools base URL (VITE_MCP_TOOLS_BASE_URL) is
 * configured, indicating that the ElevenLabs Dashboard remote MCP
 * registration URL is available.
 *
 * Note: This does NOT mean the extension sends requests to an MCP endpoint.
 * The extension always uses Hono API (client_tools_fallback). This flag
 * signals that the external ElevenLabs → SABOROU backend MCP path is set up.
 */
export function isMcpAvailable(): boolean {
  const v = import.meta.env.VITE_MCP_TOOLS_BASE_URL;
  return Boolean(v && v !== "undefined" && v !== "null");
}

// ---------------------------------------------------------------------------
// Shared fetch helper (always uses Hono API — client_tools_fallback path)
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  jwt: string,
  options: RequestInit = {},
): Promise<T> {
  // Extension always calls Hono API directly (ElevenLabs clientTools fallback).
  // Remote MCP primary path is handled externally by ElevenLabs Dashboard.
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${path}`;

  const buildHeaders = (token: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  });

  let res = await fetch(url, { ...options, headers: buildHeaders(jwt) });

  // 401 on first try: force token refresh regardless of stored expiresAt,
  // then retry once. This handles the case where the stored expiresAt is
  // in the future but the actual JWT exp claim has already passed.
  if (res.status === 401) {
    try {
      const { forceRefreshToken } = await import("@/auth/cognitoAuth");
      const freshToken = await forceRefreshToken();
      if (freshToken) {
        res = await fetch(url, {
          ...options,
          headers: buildHeaders(freshToken),
        });
      }
    } catch {
      // refresh failed — fall through to throw the original 401
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[agentClient] ${res.status} ${res.statusText}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Tool: judgeTask (saborou_judge_sabori)
// ElevenLabs clientTools fallback implementation — always calls Hono API.
// ---------------------------------------------------------------------------

export interface JudgeTaskParams {
  /** Raw message text from Slack DM */
  message: string;
  /** Optional sender name for context */
  senderName?: string;
}

export interface JudgeTaskResult {
  /** Draft reply text to send to Slack */
  replyDraft: string;
  /** Sabori judgement level 0-1 */
  saboriScore: number;
  /** Short TTS-friendly summary of the reply */
  ttsSummary: string;
}

/**
 * ElevenLabs clientTools フォールバック実装: saborou_judge_sabori
 * 常に Hono API (/api/proposals/judge) を呼び出す。
 * ElevenLabs Dashboard 経由のリモート MCP 呼び出しとは独立して動作する。
 */
export async function judgeTask(
  params: JudgeTaskParams,
  jwt: string,
): Promise<JudgeTaskResult> {
  return apiFetch<JudgeTaskResult>("/api/proposals/judge", jwt, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ---------------------------------------------------------------------------
// Tool: sendSlackReply (saborou_send_slack_reply)
// ElevenLabs clientTools fallback implementation — always calls Hono API.
// ---------------------------------------------------------------------------

export interface SendSlackReplyParams {
  /** Slack channel or DM ID */
  channelId: string;
  /** Thread timestamp to reply in-thread */
  threadTs?: string;
  /** Approved reply text */
  replyText: string;
}

/**
 * ElevenLabs clientTools フォールバック実装: saborou_send_slack_reply
 * 常に Hono API (/api/slack/reply) を呼び出す。
 */
export async function sendSlackReply(
  params: SendSlackReplyParams,
  jwt: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/api/slack/reply", jwt, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ---------------------------------------------------------------------------
// Tool: getTasks (saborou_get_tasks)
// ElevenLabs clientTools fallback implementation — always calls Hono API.
// ---------------------------------------------------------------------------

export interface Task {
  id: string;
  title: string;
  status: string;
  dueAt?: string;
}

/**
 * ElevenLabs clientTools フォールバック実装: saborou_get_tasks
 * 常に Hono API (/api/tasks) を呼び出す。
 */
export async function getTasks(jwt: string): Promise<Task[]> {
  const res = await apiFetch<{ tasks: Task[] }>("/api/tasks", jwt, {
    method: "GET",
  });
  return res.tasks;
}

// ---------------------------------------------------------------------------
// 4タブ UI 向け拡充 API（U-V4-01）
//
// すべて Hono API を直接呼ぶ（既存の apiFetch を再利用）。
// shared への依存を避けるため types.ts のローカル型を返す。
// ---------------------------------------------------------------------------

/** GET /api/tasks/candidates — Slack/Gmail 抽出済みのタスク候補一覧 */
export async function getCandidates(jwt: string): Promise<TaskCandidate[]> {
  const res = await apiFetch<{ candidates: TaskCandidate[] }>(
    "/api/tasks/candidates",
    jwt,
    { method: "GET" },
  );
  return res.candidates;
}

/** GET /api/tasks — 承認済みタスク一覧（4タブ用の詳細型） */
export async function getTaskSummaries(jwt: string): Promise<TaskSummary[]> {
  const res = await apiFetch<{ tasks: TaskSummary[] }>("/api/tasks", jwt, {
    method: "GET",
  });
  return res.tasks;
}

/** GET /api/tasks/:id — 単一タスク */
export async function getTask(
  taskId: string,
  jwt: string,
): Promise<TaskSummary> {
  return apiFetch<TaskSummary>(
    `/api/tasks/${encodeURIComponent(taskId)}`,
    jwt,
    {
      method: "GET",
    },
  );
}

/**
 * POST /api/tasks/candidates/:id/plan-steps
 * 承認モーダルを開いた時に作業ステップ草案を生成する。
 * 失敗(503)時は空配列を返し、UI 側は手動入力にフォールバックする。
 */
export async function fetchPlanSteps(
  candidateId: string,
  jwt: string,
): Promise<ScheduleStep[]> {
  try {
    const res = await apiFetch<{ steps: ScheduleStep[] }>(
      `/api/tasks/candidates/${encodeURIComponent(candidateId)}/plan-steps`,
      jwt,
      { method: "POST", body: JSON.stringify({}) },
    );
    return res.steps ?? [];
  } catch (err) {
    console.warn("[agentClient] fetchPlanSteps failed:", err);
    return [];
  }
}

/** POST /api/tasks/candidates/:id/approve — 候補を承認しタスク化する */
export async function approveCandidate(
  candidateId: string,
  jwt: string,
  overrides?: Record<string, unknown>,
): Promise<TaskSummary> {
  return apiFetch<TaskSummary>(
    `/api/tasks/candidates/${encodeURIComponent(candidateId)}/approve`,
    jwt,
    {
      method: "POST",
      body: JSON.stringify(overrides ? { overrides } : {}),
    },
  );
}

/**
 * POST /api/tasks — タスクを直接作成する（status=approved で永続化）。
 * content script が DOM 検知した live 候補は candidates テーブルに無く
 * approveCandidate が 404 になるため、その内容からタスクを実体化するのに使う。
 */
export async function createTask(
  input: { title: string; deadline?: string | null; description?: string },
  jwt: string,
): Promise<TaskSummary> {
  return apiFetch<TaskSummary>("/api/tasks", jwt, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** DELETE /api/tasks/candidates/:id — 候補を却下する */
export async function rejectCandidate(
  candidateId: string,
  jwt: string,
): Promise<void> {
  const baseUrl = getApiUrl();
  const res = await fetch(
    `${baseUrl}/api/tasks/candidates/${encodeURIComponent(candidateId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jwt}` },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[agentClient] ${res.status} ${res.statusText}: ${text}`);
  }
}

/** GET /api/google/calendar/status — カレンダーキャッシュ状態（busyScore 等） */
export async function getCalendarStatus(jwt: string): Promise<CalendarStatus> {
  try {
    return await apiFetch<CalendarStatus>("/api/google/calendar/status", jwt, {
      method: "GET",
    });
  } catch (err) {
    console.warn("[agentClient] getCalendarStatus failed:", err);
    return { cached: false };
  }
}

/** GET /api/tasks/:id/proposal — サボり提案（reasoning/verdict を含む） */
export async function getProposal(
  taskId: string,
  jwt: string,
): Promise<Proposal | null> {
  try {
    return await apiFetch<Proposal>(
      `/api/tasks/${encodeURIComponent(taskId)}/proposal`,
      jwt,
      { method: "GET" },
    );
  } catch (err) {
    console.warn("[agentClient] getProposal failed:", err);
    return null;
  }
}

/** GET /api/tasks/:id/schedule — 3バンドガント */
export async function getSchedule(
  taskId: string,
  jwt: string,
): Promise<SaboriSchedule | null> {
  try {
    const res = await apiFetch<{ schedule: SaboriSchedule }>(
      `/api/tasks/${encodeURIComponent(taskId)}/schedule`,
      jwt,
      { method: "GET" },
    );
    return res.schedule;
  } catch (err) {
    console.warn("[agentClient] getSchedule failed:", err);
    return null;
  }
}

/** GET /api/connections — サービス接続一覧（slack / google など） */
export async function getConnections(
  jwt: string,
): Promise<{ service: string; status: string }[]> {
  try {
    const res = await apiFetch<{
      connections: { service: string; status: string }[];
    }>("/api/connections", jwt, { method: "GET" });
    return res.connections ?? [];
  } catch {
    return [];
  }
}

/** DELETE /api/connections/:service — サービス接続を解除する */
export async function disconnectService(
  service: string,
  jwt: string,
): Promise<void> {
  const baseUrl = getApiUrl();
  const res = await fetch(
    `${baseUrl}/api/connections/${encodeURIComponent(service)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${jwt}` } },
  );
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`[agentClient] ${res.status} ${res.statusText}: ${text}`);
  }
}

/** GET /api/auth/slack — Slack OAuth 認可 URL を取得する */
export async function getSlackOAuthUrl(jwt: string): Promise<string> {
  const res = await apiFetch<{ url: string }>("/api/auth/slack", jwt, {
    method: "GET",
  });
  return res.url;
}

/** 余白タブのサボロー対話 1 往復の入力 */
export interface ChatTurnInput {
  /** 直近の会話履歴（古い順、最後はユーザー発話） */
  messages: { role: "user" | "saborou"; text: string }[];
  /** 対象タスクID（任意） */
  taskId?: string;
  /** タスク・スケジュール等の文脈（拡張側で組み立て済み・任意） */
  context?: string;
}

/** サボロー対話の応答 */
export interface ChatTurnResult {
  reply: string;
  action?: "progress_report" | "watch_video" | "next_task_prep" | "none";
  tone?: "warm" | "playful" | "calm";
}

/** POST /api/chat — 余白タブのサボローと1往復対話する */
export async function postChat(
  input: ChatTurnInput,
  jwt: string,
): Promise<ChatTurnResult> {
  return apiFetch<ChatTurnResult>("/api/chat", jwt, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** POST /api/tasks/:id/report — 進捗報告文（動いてるフリ）を生成する */
export async function getProgressReport(
  taskId: string,
  jwt: string,
): Promise<ProgressReport> {
  return apiFetch<ProgressReport>(
    `/api/tasks/${encodeURIComponent(taskId)}/report`,
    jwt,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export interface DelegateTaskResult {
  ok: boolean;
  taskId: string;
  channelId: string;
  ts: string;
}

/** POST /api/slack/delegations — タスクをAIに代行依頼する（approved=true必須） */
export async function delegateTask(
  taskId: string,
  channelId: string,
  jwt: string,
  options?: { instruction?: string },
): Promise<DelegateTaskResult> {
  return apiFetch<DelegateTaskResult>("/api/slack/delegations", jwt, {
    method: "POST",
    body: JSON.stringify({ taskId, channelId, approved: true, ...options }),
  });
}

// ---------------------------------------------------------------------------
// PM WBS分解 API (PM機能)
// ---------------------------------------------------------------------------

/**
 * POST /api/tasks/:taskId/decompose
 * PMBOK WBS手法でタスクをサブタスクに分解する。
 * slackContextを渡すとユーザーの嗜好に合わせた余白提案が生成される。
 */
export async function decomposeTask(
  taskId: string,
  jwt: string,
  options?: { slackContext?: string },
): Promise<GoalAnalysis> {
  const res = await apiFetch<{ taskId: string; goalAnalysis: GoalAnalysis }>(
    `/api/tasks/${encodeURIComponent(taskId)}/decompose`,
    jwt,
    {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    },
  );
  return res.goalAnalysis;
}

/**
 * GET /api/tasks/:taskId/decompose
 * 既存のGoalAnalysis（WBS分解結果）を取得する。
 * まだ分解されていない場合はnullを返す。
 */
export async function getGoalAnalysis(
  taskId: string,
  jwt: string,
): Promise<GoalAnalysis | null> {
  try {
    const res = await apiFetch<{ taskId: string; goalAnalysis: GoalAnalysis }>(
      `/api/tasks/${encodeURIComponent(taskId)}/decompose`,
      jwt,
      { method: "GET" },
    );
    return res.goalAnalysis;
  } catch (err) {
    console.warn("[agentClient] getGoalAnalysis failed:", err);
    return null;
  }
}

/**
 * PATCH /api/tasks/:taskId/subtasks/:subtaskId
 * サブタスクのステータスを更新する。
 */
export async function updateSubtaskStatus(
  taskId: string,
  subtaskId: string,
  status: SubTaskStatus,
  jwt: string,
): Promise<void> {
  await apiFetch<{ taskId: string; subtaskId: string; status: string }>(
    `/api/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subtaskId)}`,
    jwt,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}
