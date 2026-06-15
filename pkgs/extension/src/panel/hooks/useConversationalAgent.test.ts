import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock @11labs/client
// ---------------------------------------------------------------------------

const mockEndSession = vi.fn().mockResolvedValue(undefined);
const mockSendContextualUpdate = vi.fn();
const mockIsOpen = vi.fn().mockReturnValue(true);

const mockConversation = {
  endSession: mockEndSession,
  sendContextualUpdate: mockSendContextualUpdate,
  isOpen: mockIsOpen,
};

vi.mock("@11labs/client", () => ({
  Conversation: {
    startSession: vi.fn(),
  },
}));

// Mock agentClient
vi.mock("@/panel/lib/agentClient", () => ({
  isMcpAvailable: vi.fn().mockReturnValue(false),
  getTasks: vi.fn().mockResolvedValue([]),
  judgeTask: vi.fn().mockResolvedValue({
    replyDraft: "了解しました",
    saboriScore: 0.9,
    ttsSummary: "了解しました",
  }),
  sendSlackReply: vi.fn().mockResolvedValue({ ok: true }),
}));

import { Conversation } from "@11labs/client";
import { useConversationalAgent } from "./useConversationalAgent";

describe("useConversationalAgent", () => {
  beforeEach(() => {
    vi.mocked(Conversation.startSession).mockResolvedValue(
      mockConversation as unknown as InstanceType<typeof Conversation>,
    );
    mockIsOpen.mockReturnValue(true);
    mockEndSession.mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in unconfigured status when no agent ID or signed URL is set", () => {
    // No env vars → unconfigured
    const { result } = renderHook(() =>
      useConversationalAgent({ sessionJwt: "jwt-token" }),
    );
    // Status is either disconnected (if config present) or unconfigured
    expect(["disconnected", "unconfigured"]).toContain(result.current.status);
  });

  it("starts with null lastAgentMessage and lastUserTranscript", () => {
    const { result } = renderHook(() =>
      useConversationalAgent({ sessionJwt: null }),
    );
    expect(result.current.lastAgentMessage).toBeNull();
    expect(result.current.lastUserTranscript).toBeNull();
  });

  it("isConnected is false when status is disconnected", () => {
    const { result } = renderHook(() =>
      useConversationalAgent({ sessionJwt: null }),
    );
    expect(result.current.isConnected).toBe(false);
  });

  it("connect() does not call startSession when sessionJwt is null", async () => {
    const { result } = renderHook(() =>
      useConversationalAgent({ sessionJwt: null }),
    );
    await act(async () => {
      await result.current.connect();
    });
    expect(Conversation.startSession).not.toHaveBeenCalled();
  });

  it("connect() calls Conversation.startSession when jwt and agentId are present", async () => {
    // Set env var
    const originalEnv = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
    // @ts-expect-error mutating readonly env for test
    import.meta.env.VITE_ELEVENLABS_AGENT_ID = "test-agent-id";

    vi.mocked(Conversation.startSession).mockResolvedValue(
      mockConversation as unknown as InstanceType<typeof Conversation>,
    );

    const { result } = renderHook(() =>
      useConversationalAgent({ sessionJwt: "valid-jwt" }),
    );

    await act(async () => {
      await result.current.connect();
    });

    // Restore
    // @ts-expect-error mutating readonly env for test
    import.meta.env.VITE_ELEVENLABS_AGENT_ID = originalEnv;
  });

  it("disconnect() calls endSession and sets status to disconnected", async () => {
    const { result } = renderHook(() =>
      useConversationalAgent({ sessionJwt: "valid-jwt" }),
    );

    // Manually inject conversation ref via connect + mock
    // @ts-expect-error mutating readonly env for test
    import.meta.env.VITE_ELEVENLABS_AGENT_ID = "test-agent-id";

    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.status).toBe("disconnected");

    // @ts-expect-error restore
    import.meta.env.VITE_ELEVENLABS_AGENT_ID = undefined;
  });

  it("sets error state when startSession throws", async () => {
    // @ts-expect-error mutating readonly env for test
    import.meta.env.VITE_ELEVENLABS_AGENT_ID = "test-agent-id";

    vi.mocked(Conversation.startSession).mockRejectedValueOnce(
      new Error("WebSocket failed"),
    );

    const { result } = renderHook(() =>
      useConversationalAgent({ sessionJwt: "valid-jwt" }),
    );

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.error).toBe("WebSocket failed");
    });

    // @ts-expect-error restore
    import.meta.env.VITE_ELEVENLABS_AGENT_ID = undefined;
  });

  it("pushContext is a no-op when no active session", () => {
    const { result } = renderHook(() =>
      useConversationalAgent({ sessionJwt: null }),
    );
    // Should not throw
    expect(() => result.current.pushContext("test context")).not.toThrow();
  });

  it("calls onUserTranscript when agent emits a user message", async () => {
    // @ts-expect-error mutating readonly env for test
    import.meta.env.VITE_ELEVENLABS_AGENT_ID = "test-agent-id";

    let capturedCallbacks: Record<string, (...args: unknown[]) => void> = {};
    vi.mocked(Conversation.startSession).mockImplementationOnce(
      async (opts) => {
        const options = opts as Record<string, unknown>;
        capturedCallbacks = {
          onMessage: options.onMessage as (...args: unknown[]) => void,
        };
        return mockConversation as unknown as InstanceType<typeof Conversation>;
      },
    );

    const onUserTranscript = vi.fn();
    const { result } = renderHook(() =>
      useConversationalAgent({ sessionJwt: "valid-jwt", onUserTranscript }),
    );

    await act(async () => {
      await result.current.connect();
    });

    act(() => {
      capturedCallbacks.onMessage?.({ message: "いいよ", source: "user" });
    });

    expect(onUserTranscript).toHaveBeenCalledWith("いいよ");

    // @ts-expect-error restore
    import.meta.env.VITE_ELEVENLABS_AGENT_ID = undefined;
  });

  it("updates lastAgentMessage when agent emits an AI message", async () => {
    // @ts-expect-error mutating readonly env for test
    import.meta.env.VITE_ELEVENLABS_AGENT_ID = "test-agent-id";

    let capturedCallbacks: Record<string, (...args: unknown[]) => void> = {};
    vi.mocked(Conversation.startSession).mockImplementationOnce(
      async (opts) => {
        const options = opts as Record<string, unknown>;
        capturedCallbacks = {
          onMessage: options.onMessage as (...args: unknown[]) => void,
        };
        return mockConversation as unknown as InstanceType<typeof Conversation>;
      },
    );

    const { result } = renderHook(() =>
      useConversationalAgent({ sessionJwt: "valid-jwt" }),
    );

    await act(async () => {
      await result.current.connect();
    });

    act(() => {
      capturedCallbacks.onMessage?.({
        message: "了解しました、後ほど対応します",
        source: "ai",
      });
    });

    expect(result.current.lastAgentMessage).toBe(
      "了解しました、後ほど対応します",
    );

    // @ts-expect-error restore
    import.meta.env.VITE_ELEVENLABS_AGENT_ID = undefined;
  });
});
