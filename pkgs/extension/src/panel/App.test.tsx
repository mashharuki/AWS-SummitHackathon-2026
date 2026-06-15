import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

// cognitoAuth をモックして認証状態を制御する
vi.mock("@/auth/cognitoAuth", () => ({
  getValidToken: vi.fn().mockResolvedValue(null),
  parseIdToken: vi.fn().mockReturnValue({
    sub: "u1",
    email: "test@example.com",
    name: "テストユーザー",
  }),
  signIn: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

// useConversationalAgent をモックして音声 SDK への依存を排除
vi.mock("@/panel/hooks/useConversationalAgent", () => ({
  useConversationalAgent: vi.fn().mockReturnValue({
    status: "disconnected",
    mode: null,
    error: null,
    lastAgentMessage: null,
    lastUserTranscript: null,
    isConnected: false,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    pushContext: vi.fn(),
  }),
}));

// agentClient をモックして API 呼び出しを制御する
vi.mock("@/panel/lib/agentClient", () => ({
  judgeTask: vi.fn().mockResolvedValue({
    replyDraft: "了解しました。後ほど確認します。",
    saboriScore: 0.8,
    ttsSummary: "了解しました",
  }),
  sendSlackReply: vi.fn().mockResolvedValue({ ok: true }),
  isMcpAvailable: vi.fn().mockReturnValue(false),
}));

import * as cognitoAuth from "@/auth/cognitoAuth";
import * as conversationalAgentModule from "@/panel/hooks/useConversationalAgent";
import * as agentClient from "@/panel/lib/agentClient";

describe("App (Side Panel)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルト: 未認証（getValidToken が null を返す）
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue(null);
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined);
    // デフォルト: disconnected agent
    vi.mocked(conversationalAgentModule.useConversationalAgent).mockReturnValue(
      {
        status: "disconnected",
        mode: null,
        error: null,
        lastAgentMessage: null,
        lastUserTranscript: null,
        isConnected: false,
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        pushContext: vi.fn(),
      },
    );
  });

  it("ルート要素がレンダリングされる", async () => {
    render(<App />);
    expect(screen.getByTestId("app-root")).toBeInTheDocument();
    // 認証チェック完了を待つ
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );
  });

  it("SABOROU ヘッダーが表示される", async () => {
    render(<App />);
    expect(screen.getByText("SABOROU")).toBeInTheDocument();
    expect(screen.getByText("サボりの最適解")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );
  });

  it("未認証時: ログインボタンが表示される", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("sign-in-button")).toBeInTheDocument();
    expect(screen.getByTestId("unauthenticated-message")).toBeInTheDocument();
  });

  it("認証済み時: ウェルカムメッセージとユーザー情報が表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("welcome-message")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("user-info")).toBeInTheDocument();
    expect(screen.getByTestId("sign-out-button")).toBeInTheDocument();
  });

  it("承認ボタンが表示される（未認証時: 無効状態）", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );
    const approvalButton = screen.getByTestId("approval-button");
    expect(approvalButton).toBeInTheDocument();
    expect(approvalButton).toBeDisabled();
  });

  it("返信案が無い状態で承認ボタンをクリックすると承認待ちになる（認証済み）", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );

    const approvalButton = screen.getByTestId("approval-button");
    // 返信案が無い状態では 1 クリックで承認待ち（startListening）になる
    await user.click(approvalButton);
    expect(approvalButton).toHaveTextContent("「いいよ」待機中...");
  });

  it("チャット入力フィールドが表示される", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
    // 未認証時はプレースホルダーが「ログインしてください」
    expect(
      screen.getByPlaceholderText("ログインしてください"),
    ).toBeInTheDocument();
  });

  it("テキスト未入力時は送信ボタンが無効", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );
    const sendButton = screen.getByTestId("send-button");
    expect(sendButton).toBeDisabled();
  });

  it("認証済み時: テキスト入力後は送信ボタンが有効になる", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );

    const chatInput = screen.getByTestId("chat-input");
    const sendButton = screen.getByTestId("send-button");

    await user.type(chatInput, "テスト入力");
    expect(sendButton).not.toBeDisabled();
  });

  it("認証済み時: 送信後に入力フィールドがクリアされる", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );

    const chatInput = screen.getByTestId("chat-input");
    await user.type(chatInput, "テスト入力");
    await user.click(screen.getByTestId("send-button"));
    expect(chatInput).toHaveValue("");
  });

  // ---------------------------------------------------------------------------
  // U-V2-03: 音声 UI テスト
  // ---------------------------------------------------------------------------

  it("マイクボタンが表示される（未認証時は無効）", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );
    const micButton = screen.getByTestId("mic-button");
    expect(micButton).toBeInTheDocument();
    expect(micButton).toBeDisabled();
  });

  it("認証済み時: マイクボタンが有効になる", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    vi.mocked(conversationalAgentModule.useConversationalAgent).mockReturnValue(
      {
        status: "disconnected",
        mode: null,
        error: null,
        lastAgentMessage: null,
        lastUserTranscript: null,
        isConnected: false,
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        pushContext: vi.fn(),
      },
    );

    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );
    const micButton = screen.getByTestId("mic-button");
    // When agent status is "disconnected" (not "unconfigured"), button is enabled
    expect(micButton).not.toBeDisabled();
  });

  it("「いいよ」ボタン（承認フォールバック）: クリックで awaiting → approved", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    const user = userEvent.setup();

    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );

    const approvalButton = screen.getByTestId("approval-button");
    // Initial state: idle → "いいよ"
    expect(approvalButton).toHaveTextContent("いいよ");

    // 返信案が無い状態では 1 クリックで承認待ち（awaiting）になる
    await user.click(approvalButton);
    expect(approvalButton).toHaveTextContent("「いいよ」待機中...");
  });

  it("エージェント接続済み時: 音声オフメッセージが表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    vi.mocked(conversationalAgentModule.useConversationalAgent).mockReturnValue(
      {
        status: "connected",
        mode: "listening",
        error: null,
        lastAgentMessage: null,
        lastUserTranscript: null,
        isConnected: true,
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        pushContext: vi.fn(),
      },
    );

    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("agent-status-label")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("agent-status-label")).toHaveTextContent(
      "音声接続中",
    );
  });

  it("エージェントエラー時: エラーメッセージが表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    vi.mocked(conversationalAgentModule.useConversationalAgent).mockReturnValue(
      {
        status: "disconnected",
        mode: null,
        error: "WebSocket connection failed",
        lastAgentMessage: null,
        lastUserTranscript: null,
        isConnected: false,
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        pushContext: vi.fn(),
      },
    );

    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("agent-error")).toBeInTheDocument();
    expect(screen.getByTestId("agent-error")).toHaveTextContent(
      "WebSocket connection failed",
    );
  });

  it("lastAgentMessage がある時: 返信文ドラフトエリアが表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    vi.mocked(conversationalAgentModule.useConversationalAgent).mockReturnValue(
      {
        status: "connected",
        mode: "listening",
        error: null,
        lastAgentMessage: "了解しました、後ほど対応します",
        lastUserTranscript: null,
        isConnected: true,
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        pushContext: vi.fn(),
      },
    );

    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("agent-draft-area")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("reply-draft")).toHaveTextContent(
      "了解しました、後ほど対応します",
    );
  });

  it("マイクボタンクリックで connect が呼ばれる", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    const mockConnect = vi.fn().mockResolvedValue(undefined);
    vi.mocked(conversationalAgentModule.useConversationalAgent).mockReturnValue(
      {
        status: "disconnected",
        mode: null,
        error: null,
        lastAgentMessage: null,
        lastUserTranscript: null,
        isConnected: false,
        connect: mockConnect,
        disconnect: vi.fn().mockResolvedValue(undefined),
        pushContext: vi.fn(),
      },
    );

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("mic-button"));
    expect(mockConnect).toHaveBeenCalledOnce();
  });

  // ---------------------------------------------------------------------------
  // U-V2-02: content script メッセージ受信テスト
  // ---------------------------------------------------------------------------

  it("content script から NEW_SLACK_MESSAGE を受信すると通知カードが表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");

    // onMessage のリスナーをキャプチャする
    let capturedListener: ((msg: unknown, sender: unknown) => void) | null =
      null;
    const addListenerSpy = vi
      .spyOn(chrome.runtime.onMessage, "addListener")
      .mockImplementation((listener) => {
        capturedListener = listener as typeof capturedListener;
      });

    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );

    expect(capturedListener).not.toBeNull();

    // content script からのメッセージをシミュレート
    act(() => {
      capturedListener?.(
        {
          type: "NEW_SLACK_MESSAGE",
          payload: {
            text: "今日の会議の件ですが",
            sender: "山田花子",
            channelId: "U9876543210",
            threadTs: "1717900000.111111",
            detectedAt: new Date().toISOString(),
          },
        },
        {},
      );
    });

    await waitFor(() =>
      expect(
        screen.getByTestId("slack-message-notification"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId("slack-message-text")).toHaveTextContent(
      "今日の会議の件ですが",
    );

    addListenerSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // 非音声フロー: judge → 返信案表示 → ボタン承認 → Slack 送信
  // ---------------------------------------------------------------------------

  it("NEW_SLACK_MESSAGE 受信時に judgeTask が自動呼び出しされ返信案が表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    vi.mocked(agentClient.judgeTask).mockResolvedValue({
      replyDraft: "承りました。後ほど確認します。",
      saboriScore: 0.7,
      ttsSummary: "承りました",
    });

    let capturedListener: ((msg: unknown, sender: unknown) => void) | null =
      null;
    const addListenerSpy = vi
      .spyOn(chrome.runtime.onMessage, "addListener")
      .mockImplementation((listener) => {
        capturedListener = listener as typeof capturedListener;
      });

    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );

    act(() => {
      capturedListener?.(
        {
          type: "NEW_SLACK_MESSAGE",
          payload: {
            text: "資料の件よろしくお願いします",
            sender: "田中太郎",
            channelId: "C0123456789",
            threadTs: "1717900100.333333",
            detectedAt: new Date().toISOString(),
          },
        },
        {},
      );
    });

    // judgeTask が呼ばれることを確認
    await waitFor(() =>
      expect(agentClient.judgeTask).toHaveBeenCalledWith(
        { message: "資料の件よろしくお願いします", senderName: "田中太郎" },
        "fake-id-token",
      ),
    );

    // 返信案カードが表示されることを確認
    await waitFor(() =>
      expect(screen.getByTestId("judge-result-card")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("judge-reply-draft")).toHaveTextContent(
      "承りました。後ほど確認します。",
    );

    addListenerSpy.mockRestore();
  });

  it("NEW_SLACK_MESSAGE 受信時にローディング状態が表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    // judgeTask を遅延させてローディングを観察する
    vi.mocked(agentClient.judgeTask).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                replyDraft: "テスト返信",
                saboriScore: 0.5,
                ttsSummary: "テスト",
              }),
            200,
          ),
        ),
    );

    let capturedListener: ((msg: unknown, sender: unknown) => void) | null =
      null;
    const addListenerSpy = vi
      .spyOn(chrome.runtime.onMessage, "addListener")
      .mockImplementation((listener) => {
        capturedListener = listener as typeof capturedListener;
      });

    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );

    act(() => {
      capturedListener?.(
        {
          type: "NEW_SLACK_MESSAGE",
          payload: {
            text: "ローディングテスト",
            sender: "テスト送信者",
            channelId: "C9999999999",
            threadTs: "1717900200.444444",
            detectedAt: new Date().toISOString(),
          },
        },
        {},
      );
    });

    // ローディング表示を確認
    await waitFor(() =>
      expect(screen.getByTestId("judge-loading")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("judge-loading")).toHaveTextContent(
      "サボローが考え中...",
    );

    addListenerSpy.mockRestore();
  });

  it("judge API エラー時にエラーメッセージが表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    vi.mocked(agentClient.judgeTask).mockRejectedValue(
      new Error("API 接続エラー"),
    );

    let capturedListener: ((msg: unknown, sender: unknown) => void) | null =
      null;
    const addListenerSpy = vi
      .spyOn(chrome.runtime.onMessage, "addListener")
      .mockImplementation((listener) => {
        capturedListener = listener as typeof capturedListener;
      });

    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );

    act(() => {
      capturedListener?.(
        {
          type: "NEW_SLACK_MESSAGE",
          payload: {
            text: "エラーテスト",
            sender: "エラー送信者",
            channelId: "CERR00000",
            threadTs: "1717900300.555555",
            detectedAt: new Date().toISOString(),
          },
        },
        {},
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId("judge-error")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("judge-error")).toHaveTextContent(
      "返信案の生成に失敗しました",
    );

    addListenerSpy.mockRestore();
  });

  it("返信案表示後に「いいよ」ボタンで sendSlackReply が呼ばれ送信成功が表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    vi.mocked(agentClient.judgeTask).mockResolvedValue({
      replyDraft: "了解しました。後ほど確認します。",
      saboriScore: 0.8,
      ttsSummary: "了解しました",
    });
    vi.mocked(agentClient.sendSlackReply).mockResolvedValue({ ok: true });

    let capturedListener: ((msg: unknown, sender: unknown) => void) | null =
      null;
    const addListenerSpy = vi
      .spyOn(chrome.runtime.onMessage, "addListener")
      .mockImplementation((listener) => {
        capturedListener = listener as typeof capturedListener;
      });

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );

    // Slack メッセージ受信をシミュレート
    act(() => {
      capturedListener?.(
        {
          type: "NEW_SLACK_MESSAGE",
          payload: {
            text: "承認テストメッセージ",
            sender: "承認テスト送信者",
            channelId: "CAPPROVE01",
            threadTs: "1717900400.666666",
            detectedAt: new Date().toISOString(),
          },
        },
        {},
      );
    });

    // 返信案が表示されるまで待つ
    await waitFor(() =>
      expect(screen.getByTestId("judge-reply-draft")).toBeInTheDocument(),
    );

    // 承認ボタンをクリック（awaiting_approval 状態で1回クリックで送信）
    const approvalButton = screen.getByTestId("approval-button");
    await user.click(approvalButton);

    // sendSlackReply が呼ばれることを確認
    await waitFor(() =>
      expect(agentClient.sendSlackReply).toHaveBeenCalledWith(
        {
          channelId: "CAPPROVE01",
          threadTs: "1717900400.666666",
          replyText: "了解しました。後ほど確認します。",
        },
        "fake-id-token",
      ),
    );

    // 送信成功メッセージが表示されることを確認
    await waitFor(() =>
      expect(screen.getByTestId("send-success")).toBeInTheDocument(),
    );
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "TASK_REPLY_COMPLETED",
    });

    addListenerSpy.mockRestore();
  });

  it("sendSlackReply 失敗時にエラーが表示される", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    vi.mocked(agentClient.judgeTask).mockResolvedValue({
      replyDraft: "送信失敗テスト返信",
      saboriScore: 0.5,
      ttsSummary: "テスト",
    });
    vi.mocked(agentClient.sendSlackReply).mockRejectedValue(
      new Error("Slack API エラー"),
    );

    let capturedListener: ((msg: unknown, sender: unknown) => void) | null =
      null;
    const addListenerSpy = vi
      .spyOn(chrome.runtime.onMessage, "addListener")
      .mockImplementation((listener) => {
        capturedListener = listener as typeof capturedListener;
      });

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );

    act(() => {
      capturedListener?.(
        {
          type: "NEW_SLACK_MESSAGE",
          payload: {
            text: "送信失敗テスト",
            sender: "失敗テスト送信者",
            channelId: "CFAIL00001",
            threadTs: "1717900500.777777",
            detectedAt: new Date().toISOString(),
          },
        },
        {},
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId("judge-reply-draft")).toBeInTheDocument(),
    );

    const approvalButton = screen.getByTestId("approval-button");
    await user.click(approvalButton);

    await waitFor(() =>
      expect(screen.getByTestId("send-error")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("send-error")).toHaveTextContent(
      "Slack API エラー",
    );
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith({
      type: "TASK_REPLY_COMPLETED",
    });

    addListenerSpy.mockRestore();
  });

  it("パネル起動時に保留タスクを復元して判定処理を再開する", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (message: unknown) => {
        if (
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "GET_PENDING_TASK"
        ) {
          return {
            task: {
              text: "保留されていたタスクです",
              sender: "復元ユーザー",
              channelId: "C-PENDING",
              threadTs: "1717900999.999999",
              detectedAt: "2026-06-15T14:00:00.000Z",
            },
          };
        }
        return undefined;
      },
    );

    render(<App />);

    await waitFor(() =>
      expect(
        screen.getByTestId("slack-message-notification"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId("slack-message-text")).toHaveTextContent(
      "保留されていたタスクです",
    );
    await waitFor(() =>
      expect(agentClient.judgeTask).toHaveBeenCalledWith(
        {
          message: "保留されていたタスクです",
          senderName: "復元ユーザー",
        },
        "fake-id-token",
      ),
    );
  });

  it("NEW_SLACK_MESSAGE 受信時に agent.pushContext が呼ばれる", async () => {
    vi.mocked(cognitoAuth.getValidToken).mockResolvedValue("fake-id-token");
    const mockPushContext = vi.fn();
    vi.mocked(conversationalAgentModule.useConversationalAgent).mockReturnValue(
      {
        status: "disconnected",
        mode: null,
        error: null,
        lastAgentMessage: null,
        lastUserTranscript: null,
        isConnected: false,
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        pushContext: mockPushContext,
      },
    );

    let capturedListener: ((msg: unknown, sender: unknown) => void) | null =
      null;
    const addListenerSpy = vi
      .spyOn(chrome.runtime.onMessage, "addListener")
      .mockImplementation((listener) => {
        capturedListener = listener as typeof capturedListener;
      });

    render(<App />);
    await waitFor(() =>
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
    );

    act(() => {
      capturedListener?.(
        {
          type: "NEW_SLACK_MESSAGE",
          payload: {
            text: "資料の確認をお願いします",
            sender: "鈴木一郎",
            channelId: "U1111111111",
            threadTs: "1717900001.222222",
            detectedAt: new Date().toISOString(),
          },
        },
        {},
      );
    });

    await waitFor(() => expect(mockPushContext).toHaveBeenCalled());
    expect(mockPushContext).toHaveBeenCalledWith(
      expect.stringContaining("鈴木一郎"),
    );
    expect(mockPushContext).toHaveBeenCalledWith(
      expect.stringContaining("資料の確認をお願いします"),
    );

    addListenerSpy.mockRestore();
  });
});
