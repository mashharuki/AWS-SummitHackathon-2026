/**
 * useConversationalAgent — EXT-02
 *
 * Manages an ElevenLabs Conversational AI session (Conversation.startSession).
 * SDK: @11labs/client@0.2.0
 *
 * Architecture notes (TP-06):
 * - @11labs/client 0.2.0 clientTools accepts plain function callbacks,
 *   NOT an MCP URL. The "mcp" field from the design doc is therefore NOT
 *   implemented here — MCP connectivity is handled via direct fetch in
 *   agentClient.ts, with those functions registered as clientTools.
 * - If agentId or signed URL is not configured, the hook stays disconnected
 *   and returns a "no-agent" status, allowing the button fallback to work.
 * - JWT is accepted as a prop (sessionJwt) so the hook is decoupled from
 *   auth internals; callers pass the result of getValidToken().
 *
 * Connection config:
 *   VITE_ELEVENLABS_AGENT_ID  — public agent ID (optional; omit to use signedUrl)
 *   VITE_ELEVENLABS_SIGNED_URL — signed WebSocket URL (optional; generated server-side)
 *
 * The caller must supply the Cognito JWT so that clientTools can forward it
 * to the backend APIs via agentClient.
 */

import { getTasks, judgeTask, sendSlackReply } from "@/panel/lib/agentClient";
import { Conversation } from "@11labs/client";
import type { Mode, Status } from "@11labs/client";
import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Extended status that covers the "no agent configured" case */
export type AgentStatus = Status | "unconfigured";

export interface ConversationalAgentState {
  status: AgentStatus;
  mode: Mode | null;
  error: string | null;
  /** Most recent AI message text (used to populate the draft display area) */
  lastAgentMessage: string | null;
  /** Most recent user transcript */
  lastUserTranscript: string | null;
}

/**
 * The Slack reply the agent can send when the user says "送って".
 * App keeps this in sync with whatever draft is currently on screen so the
 * agent never has to recover the long channelId from the transcript.
 */
export interface ActiveSlackReply {
  channelId: string;
  threadTs?: string;
  replyText: string;
}

export interface UseConversationalAgentOptions {
  /**
   * Valid Cognito JWT. Pass null/undefined to keep the session disconnected.
   * When the JWT changes the current session is ended and a new one starts.
   */
  sessionJwt: string | null | undefined;
  /** Called when the agent emits a user transcript (for voice approval) */
  onUserTranscript?: (transcript: string) => void;
  /**
   * The reply currently displayed on screen. When the agent calls
   * saborou_send_slack_reply without explicit args, these values are used so
   * "送って" works without the agent having to repeat the channelId/draft.
   */
  activeReply?: ActiveSlackReply | null;
  /** Called after the agent successfully sends a Slack reply via clientTools */
  onReplySent?: () => void;
}

export interface UseConversationalAgentReturn extends ConversationalAgentState {
  /** Start a session (no-op if already connected or unconfigured) */
  connect: () => Promise<void>;
  /** End the current session gracefully */
  disconnect: () => Promise<void>;
  /**
   * Send a contextual update to the agent (e.g., a new Slack message).
   * The agent will incorporate this into its next response.
   */
  pushContext: (text: string) => void;
  /** Whether the agent is in an active, usable state */
  isConnected: boolean;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getAgentId(): string | null {
  return import.meta.env.VITE_ELEVENLABS_AGENT_ID ?? null;
}

function getSignedUrl(): string | null {
  return import.meta.env.VITE_ELEVENLABS_SIGNED_URL ?? null;
}

function isAgentConfigured(): boolean {
  return Boolean(getAgentId() || getSignedUrl());
}

/**
 * Client-side overrides (Japanese language / system prompt / first message)
 * are OPT-IN. ElevenLabs rejects the connection if an override is sent but not
 * enabled in the dashboard (Security → Overrides), which shows up as an
 * immediate connect→disconnect loop. Enable this only AFTER the dashboard
 * overrides are turned on, by setting VITE_ELEVENLABS_ENABLE_OVERRIDES=true.
 */
function areOverridesEnabled(): boolean {
  return import.meta.env.VITE_ELEVENLABS_ENABLE_OVERRIDES === "true";
}

/**
 * System prompt sent as an override so the agent always behaves as SABOROU in
 * Japanese, regardless of the dashboard default. Requires the matching
 * override (prompt / language / first message) to be enabled in the ElevenLabs
 * dashboard, otherwise it is silently ignored.
 */
const AGENT_SYSTEM_PROMPT =
  "あなたは「SABOROU（サボロー）」というサボり支援アシスタントです。" +
  "必ず日本語で、短く親しみやすく話してください。" +
  "ユーザーにSlackの新着メッセージが届くと、画面に返信案が表示されます。" +
  "ユーザーが「送って」「いいよ」「OK」など承認の意思を示したら、" +
  "saborou_send_slack_reply ツールを引数なしで呼び出してください" +
  "（channelId・返信文は画面の返信案が自動的に使われます）。" +
  "返信内容を聞き返す必要はありません。承認されたら即座に送信してください。" +
  "【読み上げルール】" +
  "人名の読み方: 近藤晴輝→こんどうはるき、近藤→こんどう、晴輝→はるき、" +
  "伊藤雄太朗→いとうゆうたろう、伊藤→いとう、雄太朗→ゆうたろう、" +
  "mameta→まめた。読めない漢字の人名はゆっくりそのまま読む。" +
  "英語略語の読み方: AWS→エーダブリューエス、MCP→エムシーピー、" +
  "AI-DLC→エーアイディーエルシー、AI→エーアイ、API→エーピーアイ、" +
  "PWA→ピーダブリューエー、UI→ユーアイ、UX→ユーエックス、" +
  "PM→ピーエム、Gmail→ジーメール、E2E→エンドツーエンド、IQ→アイキュー。" +
  "タスクを列挙するとき: 総数を先に述べてから「〇番目は〇〇さんからの『タイトル』です」の形式で読む。";

const AGENT_FIRST_MESSAGE =
  "こんにちは、SABOROU です。Slackに自分宛てのメッセージが届いたら、返信案を出しますね。";

const MICROPHONE_PERMISSION_ERROR =
  "マイク許可用のタブを開きました。そのタブで「マイクを許可」を押し、許可後にSABOROUへ戻ってもう一度音声接続してください。";

function sanitizeConnectionError(message: string): string {
  if (/subprotocol.*invalid/i.test(message) && /bearer/i.test(message)) {
    return "ElevenLabs接続の認証設定が不正です。拡張機能を更新して、もう一度音声接続してください。";
  }

  return message
    .replace(/bearer\.Bearer\s+[^\s'"]+/gi, "bearer.[REDACTED]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED_JWT]",
    );
}

async function openMicrophonePermissionPage(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.runtime?.getURL) return;

  const url = chrome.runtime.getURL("mic-permission.html");
  if (chrome.tabs?.create) {
    await chrome.tabs.create({ url });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Request microphone permission while the connect button's user gesture is
 * still active. ElevenLabs requests the microphone internally as well, but a
 * separate preflight lets us provide a useful recovery message when Chrome's
 * permission prompt is dismissed or blocked.
 */
export async function requestMicrophoneAccess(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "この環境ではマイクを利用できません。Chromeの最新版でSABOROUを開いてください。",
    );
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isPermissionError =
      (error instanceof DOMException && error.name === "NotAllowedError") ||
      /permission|dismissed|denied|not allowed/i.test(message);

    if (isPermissionError) {
      await openMicrophonePermissionPage();
      throw new Error(MICROPHONE_PERMISSION_ERROR);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const INITIAL_STATE: ConversationalAgentState = {
  status: "disconnected",
  mode: null,
  error: null,
  lastAgentMessage: null,
  lastUserTranscript: null,
};

export function useConversationalAgent(
  options: UseConversationalAgentOptions,
): UseConversationalAgentReturn {
  const { sessionJwt, onUserTranscript, activeReply, onReplySent } = options;

  const [state, setState] = useState<ConversationalAgentState>(() => ({
    ...INITIAL_STATE,
    status: isAgentConfigured() ? "disconnected" : "unconfigured",
  }));

  const conversationRef = useRef<Conversation | null>(null);
  const onUserTranscriptRef = useRef(onUserTranscript);
  // Keep latest JWT ref so clientTools closures pick up refreshed tokens
  const jwtRef = useRef(sessionJwt);
  // Keep latest active reply + callback so clientTools closures stay current
  const activeReplyRef = useRef(activeReply);
  const onReplySentRef = useRef(onReplySent);

  useEffect(() => {
    onUserTranscriptRef.current = onUserTranscript;
    onReplySentRef.current = onReplySent;
  });
  useEffect(() => {
    activeReplyRef.current = activeReply;
  }, [activeReply]);
  useEffect(() => {
    jwtRef.current = sessionJwt;
  }, [sessionJwt]);

  // ---------------------------------------------------------------------------
  // clientTools — registered as ElevenLabs client-side tool handlers
  // Each function is invoked by the ElevenLabs agent when it decides to call
  // a tool. We forward the call to agentClient which handles MCP/Hono routing.
  // ---------------------------------------------------------------------------

  const buildClientTools = useCallback(() => {
    return {
      saborou_get_tasks: async (_params: Record<string, unknown>) => {
        console.info("[SABOROU] clientTool called: saborou_get_tasks");
        const jwt = jwtRef.current;
        if (!jwt) return JSON.stringify({ error: "not authenticated" });
        try {
          const tasks = await getTasks(jwt);
          return JSON.stringify({ tasks });
        } catch (err) {
          return JSON.stringify({ error: String(err) });
        }
      },

      saborou_judge_sabori: async (params: Record<string, unknown>) => {
        console.info("[SABOROU] clientTool called: saborou_judge_sabori");
        const jwt = jwtRef.current;
        if (!jwt) return JSON.stringify({ error: "not authenticated" });
        try {
          const result = await judgeTask(
            {
              message: String(params.message ?? ""),
              senderName: params.senderName
                ? String(params.senderName)
                : undefined,
            },
            jwt,
          );
          return JSON.stringify(result);
        } catch (err) {
          return JSON.stringify({ error: String(err) });
        }
      },

      saborou_send_slack_reply: async (params: Record<string, unknown>) => {
        console.info(
          "[SABOROU] clientTool called: saborou_send_slack_reply",
          params,
        );
        const jwt = jwtRef.current;
        if (!jwt) return JSON.stringify({ error: "not authenticated" });

        // Fall back to the reply currently displayed on screen so the user can
        // just say "送って" without the agent reconstructing channelId/draft.
        const active = activeReplyRef.current;
        const channelId = params.channelId
          ? String(params.channelId)
          : (active?.channelId ?? "");
        const threadTs = params.threadTs
          ? String(params.threadTs)
          : active?.threadTs;
        const replyText = params.replyText
          ? String(params.replyText)
          : (active?.replyText ?? "");

        if (!channelId || !replyText) {
          return JSON.stringify({
            error: "no_active_reply",
            message:
              "送信できる返信案がありません。先にSlackメッセージを受け取ってください。",
          });
        }

        try {
          const result = await sendSlackReply(
            { channelId, threadTs, replyText },
            jwt,
          );
          onReplySentRef.current?.();
          return JSON.stringify(result);
        } catch (err) {
          return JSON.stringify({ error: String(err) });
        }
      },
    };
  }, []);

  // ---------------------------------------------------------------------------
  // connect / disconnect
  // ---------------------------------------------------------------------------

  const disconnect = useCallback(async () => {
    const conv = conversationRef.current;
    if (!conv) return;
    conversationRef.current = null;
    try {
      await conv.endSession();
    } catch {
      // Ignore errors on teardown
    }
    setState((prev) => ({ ...prev, status: "disconnected", mode: null }));
  }, []);

  const connect = useCallback(async () => {
    if (!isAgentConfigured()) return;
    if (!sessionJwt) return;
    // Already connected / connecting
    if (
      conversationRef.current?.isOpen() ||
      state.status === "connecting" ||
      state.status === "connected"
    ) {
      return;
    }

    setState((prev) => ({ ...prev, status: "connecting", error: null }));

    try {
      await requestMicrophoneAccess();

      const agentId = getAgentId();
      const signedUrl = getSignedUrl();

      // Build session config depending on what is available.
      // We use PartialOptions spread because the union discriminant (agentId
      // vs signedUrl vs conversationToken) is determined at runtime.
      // biome-ignore lint/suspicious/noExplicitAny: ElevenLabs SDK PartialOptions is a discriminated union; runtime construction requires any
      const sessionConfig: Record<string, any> = {
        clientTools: buildClientTools(),
        onConnect: ({ conversationId }: { conversationId: string }) => {
          console.info("[SABOROU] ElevenLabs connected:", conversationId);
          setState((prev) => ({ ...prev, status: "connected", error: null }));
        },
        onDisconnect: (details?: unknown) => {
          // details carries the close reason (e.g. rejected overrides).
          console.info("[SABOROU] ElevenLabs disconnected", details ?? "");
          conversationRef.current = null;
          setState((prev) => ({ ...prev, status: "disconnected", mode: null }));
        },
        onError: (message: string) => {
          const safeMessage = sanitizeConnectionError(message);
          console.error("[SABOROU] ElevenLabs error:", safeMessage);
          setState((prev) => ({
            ...prev,
            error: safeMessage,
            status: "disconnected",
          }));
        },
        onModeChange: ({ mode }: { mode: Mode }) => {
          setState((prev) => ({ ...prev, mode }));
        },
        onStatusChange: ({ status }: { status: Status }) => {
          setState((prev) => ({ ...prev, status }));
        },
        onMessage: ({
          message,
          source,
        }: { message: string; source: string }) => {
          if (source === "ai") {
            setState((prev) => ({ ...prev, lastAgentMessage: message }));
          } else if (source === "user") {
            setState((prev) => ({ ...prev, lastUserTranscript: message }));
            onUserTranscriptRef.current?.(message);
          }
        },
        onDebug: (info: unknown) => {
          console.debug("[SABOROU] ElevenLabs debug:", info);
        },
      };

      if (signedUrl) {
        sessionConfig.signedUrl = signedUrl;
      } else if (agentId) {
        sessionConfig.agentId = agentId;
      }

      // Overrides are opt-in: sending them when the dashboard hasn't enabled
      // the matching override causes ElevenLabs to reject the connection
      // (immediate connect→disconnect). Only attach once explicitly enabled.
      if (areOverridesEnabled()) {
        sessionConfig.overrides = {
          agent: {
            language: "ja",
            firstMessage: AGENT_FIRST_MESSAGE,
            prompt: { prompt: AGENT_SYSTEM_PROMPT },
          },
        };
      }

      const conv = await Conversation.startSession(
        sessionConfig as Parameters<typeof Conversation.startSession>[0],
      );
      conversationRef.current = conv;
    } catch (err) {
      const message = sanitizeConnectionError(
        err instanceof Error ? err.message : String(err),
      );
      console.error("[SABOROU] Failed to start ElevenLabs session:", message);
      setState((prev) => ({
        ...prev,
        status: "disconnected",
        error: message,
      }));
    }
  }, [sessionJwt, state.status, buildClientTools]);

  // ---------------------------------------------------------------------------
  // pushContext: sends a contextual update to the active session
  // ---------------------------------------------------------------------------

  const pushContext = useCallback((text: string) => {
    const conv = conversationRef.current;
    if (!conv?.isOpen()) {
      console.warn("[SABOROU] Cannot push context: no active session");
      return;
    }
    conv.sendContextualUpdate(text);
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-disconnect when JWT is revoked
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!sessionJwt && conversationRef.current?.isOpen()) {
      disconnect();
    }
  }, [sessionJwt, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      conversationRef.current?.endSession().catch(() => {});
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    pushContext,
    isConnected: state.status === "connected",
  };
}
