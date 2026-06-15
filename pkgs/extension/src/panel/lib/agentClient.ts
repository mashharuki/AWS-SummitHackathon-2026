/**
 * Agent client: abstraction layer for calling the backend API.
 *
 * Primary path: AgentCore Gateway MCP endpoint (VITE_AGENTCORE_GATEWAY_URL)
 * Fallback path: Hono API direct call (VITE_API_URL)
 *
 * API keys are never held in the extension. All requests carry the
 * Cognito JWT from getValidToken() in the Authorization header.
 *
 * MCP over HTTP is not yet stable in @11labs/client 0.2.0 — the
 * clientTools config accepts plain function callbacks, not an MCP URL.
 * This module therefore implements direct fetch calls and exposes a
 * isMcpAvailable() helper so useConversationalAgent can register the
 * same operations as ElevenLabs clientTools.
 */

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getAgentCoreUrl(): string | null {
  const v = import.meta.env.VITE_AGENTCORE_GATEWAY_URL;
  // Only return a value when it is a non-empty, non-placeholder string
  if (!v || v === "undefined" || v === "null") return null;
  return v;
}

function getApiUrl(): string {
  const v = import.meta.env.VITE_API_URL;
  if (!v || v === "undefined" || v === "null") {
    return "https://api.saborou.example.com";
  }
  return v;
}

/**
 * Returns true when AgentCore Gateway URL is configured.
 * clientTools in the ElevenLabs SDK will prefer AgentCore when available.
 */
export function isMcpAvailable(): boolean {
  return Boolean(getAgentCoreUrl());
}

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  jwt: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = getAgentCoreUrl() ?? getApiUrl();
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

export async function judgeTask(
  params: JudgeTaskParams,
  jwt: string,
): Promise<JudgeTaskResult> {
  // Try AgentCore (MCP path) first, fall back to Hono direct
  try {
    if (isMcpAvailable()) {
      return await apiFetch<JudgeTaskResult>(
        "/mcp/tools/saborou_judge_sabori",
        jwt,
        { method: "POST", body: JSON.stringify(params) },
      );
    }
  } catch (err) {
    console.warn(
      "[agentClient] AgentCore unavailable, falling back to API",
      err,
    );
  }

  return apiFetch<JudgeTaskResult>("/api/proposals/judge", jwt, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ---------------------------------------------------------------------------
// Tool: sendSlackReply (saborou_send_slack_reply)
// ---------------------------------------------------------------------------

export interface SendSlackReplyParams {
  /** Slack channel or DM ID */
  channelId: string;
  /** Thread timestamp to reply in-thread */
  threadTs?: string;
  /** Approved reply text */
  replyText: string;
}

export async function sendSlackReply(
  params: SendSlackReplyParams,
  jwt: string,
): Promise<{ ok: boolean }> {
  try {
    if (isMcpAvailable()) {
      return await apiFetch<{ ok: boolean }>(
        "/mcp/tools/saborou_send_slack_reply",
        jwt,
        { method: "POST", body: JSON.stringify(params) },
      );
    }
  } catch (err) {
    console.warn(
      "[agentClient] AgentCore unavailable, falling back to API",
      err,
    );
  }

  return apiFetch<{ ok: boolean }>("/api/slack/reply", jwt, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ---------------------------------------------------------------------------
// Tool: getTasks (saborou_get_tasks)
// ---------------------------------------------------------------------------

export interface Task {
  id: string;
  title: string;
  status: string;
  dueAt?: string;
}

export async function getTasks(jwt: string): Promise<Task[]> {
  try {
    if (isMcpAvailable()) {
      const res = await apiFetch<{ tasks: Task[] }>(
        "/mcp/tools/saborou_get_tasks",
        jwt,
        { method: "POST", body: JSON.stringify({}) },
      );
      return res.tasks;
    }
  } catch (err) {
    console.warn(
      "[agentClient] AgentCore unavailable, falling back to API",
      err,
    );
  }

  const res = await apiFetch<{ tasks: Task[] }>("/api/tasks", jwt, {
    method: "GET",
  });
  return res.tasks;
}
