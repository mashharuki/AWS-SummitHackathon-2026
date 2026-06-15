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

export interface UseConversationalAgentOptions {
  /**
   * Valid Cognito JWT. Pass null/undefined to keep the session disconnected.
   * When the JWT changes the current session is ended and a new one starts.
   */
  sessionJwt: string | null | undefined;
  /** Called when the agent emits a user transcript (for voice approval) */
  onUserTranscript?: (transcript: string) => void;
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
  const { sessionJwt, onUserTranscript } = options;

  const [state, setState] = useState<ConversationalAgentState>(() => ({
    ...INITIAL_STATE,
    status: isAgentConfigured() ? "disconnected" : "unconfigured",
  }));

  const conversationRef = useRef<Conversation | null>(null);
  const onUserTranscriptRef = useRef(onUserTranscript);
  // Keep latest JWT ref so clientTools closures pick up refreshed tokens
  const jwtRef = useRef(sessionJwt);

  useEffect(() => {
    onUserTranscriptRef.current = onUserTranscript;
  });
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
        const jwt = jwtRef.current;
        if (!jwt) return JSON.stringify({ error: "not authenticated" });
        try {
          const result = await sendSlackReply(
            {
              channelId: String(params.channelId ?? ""),
              threadTs: params.threadTs ? String(params.threadTs) : undefined,
              replyText: String(params.replyText ?? ""),
            },
            jwt,
          );
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
        onDisconnect: () => {
          console.info("[SABOROU] ElevenLabs disconnected");
          conversationRef.current = null;
          setState((prev) => ({ ...prev, status: "disconnected", mode: null }));
        },
        onError: (message: string) => {
          console.error("[SABOROU] ElevenLabs error:", message);
          setState((prev) => ({
            ...prev,
            error: message,
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
        // Pass Cognito JWT in the authorization header
        sessionConfig.authorization = `Bearer ${sessionJwt}`;
      }

      const conv = await Conversation.startSession(
        sessionConfig as Parameters<typeof Conversation.startSession>[0],
      );
      conversationRef.current = conv;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
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
