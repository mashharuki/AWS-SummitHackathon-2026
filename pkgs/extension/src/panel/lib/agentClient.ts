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

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getApiUrl(): string {
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

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      ...options.headers,
    },
  });

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
