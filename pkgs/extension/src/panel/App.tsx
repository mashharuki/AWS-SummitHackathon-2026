import {
  getValidToken,
  parseIdToken,
  signIn,
  signOut,
} from "@/auth/cognitoAuth";
import { cn } from "@/lib/utils";
import type {
  ExtensionRuntimeMessage,
  NewSlackMessagePayload,
  PendingTaskResponse,
  SidePanelReadyMessage,
} from "@/messages";
import { SIDE_PANEL_PORT_NAME } from "@/messages";
import { NotificationSettingsMenu } from "@/panel/NotificationSettingsMenu";
import { useConversationalAgent } from "@/panel/hooks/useConversationalAgent";
import {
  isApprovalPhrase,
  isCancellationPhrase,
  normalizeTranscript,
  useVoiceApproval,
} from "@/panel/hooks/useVoiceApproval";
import { judgeTask, sendSlackReply } from "@/panel/lib/agentClient";
import {
  CheckCircle,
  Loader2,
  LogIn,
  LogOut,
  MessageCircle,
  Mic,
  MicOff,
  Send,
  User,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * SABOROU Side Panel App
 *
 * U-V2-01: scaffold
 * U-V2-08: Cognito auth UI
 * U-V2-03: ElevenLabs voice agent + voice approval
 * U-V2-02: content script message receiving
 * U-V2-xx: non-voice flow — judge → display → button approve → sendSlackReply
 */

interface UserInfo {
  sub: string;
  email: string;
  name: string;
}

/** content script から受信した Slack メッセージの通知 */
type SlackMessageNotification = NewSlackMessagePayload;

/** judge 処理の状態 */
type JudgeStatus = "idle" | "loading" | "ready" | "error";

/** Slack 送信の状態 */
type SendStatus = "idle" | "sending" | "sent" | "error";

export function App() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [sessionJwt, setSessionJwt] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  /** content script から受信した最新の Slack メッセージ */
  const [latestSlackMessage, setLatestSlackMessage] =
    useState<SlackMessageNotification | null>(null);

  /** judge API が生成した返信案 */
  const [replyDraft, setReplyDraft] = useState<string | null>(null);
  /** judge 処理の状態 */
  const [judgeStatus, setJudgeStatus] = useState<JudgeStatus>("idle");
  /** judge エラー詳細 */
  const [judgeError, setJudgeError] = useState<string | null>(null);

  /** Slack 送信状態 */
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle");
  /** 送信エラー詳細 */
  const [sendError, setSendError] = useState<string | null>(null);

  // sessionJwt は useCallback 内で参照するため ref でも保持する
  const sessionJwtRef = useRef<string | null>(null);
  useEffect(() => {
    sessionJwtRef.current = sessionJwt;
  }, [sessionJwt]);

  // 送信状態を ref でも保持（二重送信ガードを最新値で判定するため）
  const sendStatusRef = useRef<SendStatus>("idle");
  useEffect(() => {
    sendStatusRef.current = sendStatus;
  }, [sendStatus]);

  // voiceApproval.startListening を ref で保持し useEffect の依存配列問題を回避する
  const startListeningRef = useRef<() => void>(() => {});
  // 送信処理を ref で保持（音声 onApproved から最新版を呼ぶため）
  const sendCurrentReplyRef = useRef<() => Promise<boolean>>(async () => false);
  // 返信案を ref で保持（トランスクリプト判定から最新値を参照するため）
  const replyDraftRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // Voice approval hook
  // ---------------------------------------------------------------------------

  const voiceApproval = useVoiceApproval({
    timeoutMs: 3000,
    onApproved: () => {
      console.info("[SABOROU] Voice approval: approved → sending");
      // 音声フレーズ判定（「いいよ」等）で承認されたら実際に送信する。
      // ElevenLabs Agent がツールを呼ばなくても、この経路で確実に送れる。
      void sendCurrentReplyRef.current();
    },
    onRejected: (reason) => {
      console.info("[SABOROU] Voice approval rejected:", reason);
    },
  });

  // startListening の最新版を ref に同期する
  useEffect(() => {
    startListeningRef.current = voiceApproval.startListening;
  });

  // ---------------------------------------------------------------------------
  // Conversational agent hook
  // ---------------------------------------------------------------------------

  // replyDraft の最新値を ref に同期
  useEffect(() => {
    replyDraftRef.current = replyDraft;
  }, [replyDraft]);

  const handleUserTranscript = useCallback(
    (transcript: string) => {
      // 返信案が画面にある間は、3秒の承認待ちに縛られず常に「いいよ」を拾う。
      // ElevenLabs Agent がツールを呼ばなくても、この経路で確実に送信できる。
      const hasDraft = Boolean(replyDraftRef.current);
      const canSend =
        sendStatusRef.current === "idle" || sendStatusRef.current === "error";

      if (hasDraft && canSend) {
        const normalized = normalizeTranscript(transcript);
        if (isApprovalPhrase(normalized)) {
          console.info(
            "[SABOROU] Approval phrase detected in transcript → sending",
          );
          void sendCurrentReplyRef.current();
          return;
        }
        if (isCancellationPhrase(normalized)) {
          console.info("[SABOROU] Cancellation phrase detected");
          voiceApproval.cancel();
          return;
        }
      }

      // 承認待ち状態のときは従来のフレーズ判定にも回す（ボタン併用フロー）
      voiceApproval.processTranscript(transcript);
    },
    [voiceApproval],
  );

  // The reply currently on screen — handed to the agent so "送って" can send it
  // without the agent having to recover the channelId from the transcript.
  const activeReply =
    latestSlackMessage && replyDraft
      ? {
          channelId: latestSlackMessage.channelId,
          threadTs: latestSlackMessage.threadTs || undefined,
          replyText: replyDraft,
        }
      : null;

  const agent = useConversationalAgent({
    sessionJwt,
    onUserTranscript: handleUserTranscript,
    activeReply,
    onReplySent: () => {
      setSendStatus("sent");
      voiceApproval.approve();
      chrome.runtime
        .sendMessage({ type: "TASK_REPLY_COMPLETED" })
        .catch((err: unknown) => {
          console.warn("[SABOROU] Completion notification failed:", err);
        });
    },
  });

  // ---------------------------------------------------------------------------
  // Content script message bridge (U-V2-02) + non-voice judge flow
  // ---------------------------------------------------------------------------

  const handleNewSlackMessage = useCallback(
    (payload: NewSlackMessagePayload) => {
      setLatestSlackMessage(payload);
      agent.pushContext(
        `Slack から新着メッセージが届きました。送信者: ${payload.sender}、内容: ${payload.text}`,
      );

      const jwt = sessionJwtRef.current;
      if (!jwt) return;

      setReplyDraft(null);
      setJudgeError(null);
      setSendStatus("idle");
      setSendError(null);
      setJudgeStatus("loading");

      judgeTask({ message: payload.text, senderName: payload.sender }, jwt)
        .then((result) => {
          setReplyDraft(result.replyDraft);
          setJudgeStatus("ready");
          // Tell the agent a reply is ready so "送って" sends it via clientTools.
          agent.pushContext(
            `返信案ができました。${payload.sender} さんへの返信文は「${result.replyDraft}」です。` +
              "ユーザーが「送って」「いいよ」などと言ったら、saborou_send_slack_reply ツールを呼んでこの返信を送信してください。引数は省略してかまいません（画面の返信案が使われます）。",
          );
          startListeningRef.current();
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "judge API エラー";
          console.error("[SABOROU] judgeTask failed:", msg);
          setJudgeError(msg);
          setJudgeStatus("error");
        });
    },
    [agent.pushContext],
  );

  useEffect(() => {
    const listener = (
      message: ExtensionRuntimeMessage,
      _sender: chrome.runtime.MessageSender,
    ) => {
      if (message.type === "NEW_SLACK_MESSAGE") {
        handleNewSlackMessage(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [handleNewSlackMessage]);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: SIDE_PANEL_PORT_NAME });
    chrome.windows
      .getCurrent()
      .then((currentWindow) => {
        const readyMessage: SidePanelReadyMessage = {
          type: "PANEL_READY",
          windowId: currentWindow.id,
        };
        port.postMessage(readyMessage);
      })
      .catch(() => {
        port.postMessage({
          type: "PANEL_READY",
        } satisfies SidePanelReadyMessage);
      });

    return () => {
      port.disconnect();
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    chrome.runtime
      .sendMessage({ type: "GET_PENDING_TASK" })
      .then((response: PendingTaskResponse | undefined) => {
        if (response?.task) {
          handleNewSlackMessage(response.task);
        }
      })
      .catch((err: unknown) => {
        console.warn("[SABOROU] Failed to restore pending task:", err);
      });
  }, [authLoading, handleNewSlackMessage]);

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getValidToken();
        if (!cancelled) {
          if (token) {
            setUserInfo(parseIdToken(token));
            setSessionJwt(token);
          } else {
            setUserInfo(null);
            setSessionJwt(null);
          }
        }
      } catch {
        if (!cancelled) {
          setUserInfo(null);
          setSessionJwt(null);
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signIn();
      const token = await getValidToken();
      if (token) {
        setUserInfo(parseIdToken(token));
        setSessionJwt(token);
      }
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "ログインに失敗しました",
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await agent.disconnect();
      await signOut();
      setUserInfo(null);
      setSessionJwt(null);
    } finally {
      setAuthLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Voice agent connection toggle
  // ---------------------------------------------------------------------------

  const handleMicToggle = async () => {
    if (agent.isConnected) {
      await agent.disconnect();
    } else {
      await agent.connect();
    }
  };

  // ---------------------------------------------------------------------------
  // Approval + Slack 送信
  // ---------------------------------------------------------------------------

  /**
   * 画面に出ている返信案を実際に送信する共通処理。
   * ボタン・音声フレーズ判定・ElevenLabs ツールの全経路から呼ばれる。
   * 二重送信は sendStatusRef で防ぐ。
   */
  const sendCurrentReply = useCallback(async (): Promise<boolean> => {
    const jwt = sessionJwtRef.current;
    if (!jwt || !latestSlackMessage || !replyDraft) return false;
    // 二重送信防止（ボタンと音声が同時に発火しても1回だけ送る）
    if (sendStatusRef.current === "sending" || sendStatusRef.current === "sent")
      return false;

    setSendStatus("sending");
    setSendError(null);

    try {
      // 主経路: API 経由送信
      await sendSlackReply(
        {
          channelId: latestSlackMessage.channelId,
          threadTs: latestSlackMessage.threadTs || undefined,
          replyText: replyDraft,
        },
        jwt,
      );
      setSendStatus("sent");
      chrome.runtime
        .sendMessage({ type: "TASK_REPLY_COMPLETED" })
        .catch((err: unknown) => {
          console.warn("[SABOROU] Completion notification failed:", err);
        });

      // 補助経路: content script DOM 送信（Slack UI に反映させる）
      chrome.runtime
        .sendMessage({ type: "SEND_SLACK_REPLY", text: replyDraft })
        .catch((err: unknown) => {
          // content script が応答しなくても API 送信は成功しているので無視
          console.warn("[SABOROU] DOM reply fallback failed:", err);
        });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Slack 送信エラー";
      console.error("[SABOROU] sendSlackReply failed:", msg);
      setSendError(msg);
      setSendStatus("error");
      return false;
    }
  }, [latestSlackMessage, replyDraft]);

  // 音声フレーズ判定で「いいよ」を拾ったときの送信を ref 経由で行う
  // （useVoiceApproval の onApproved から最新の sendCurrentReply を呼ぶため）
  useEffect(() => {
    sendCurrentReplyRef.current = sendCurrentReply;
  });

  const handleApprovalButtonClick = useCallback(async () => {
    if (!userInfo) return;

    // 送信完了/エラー後にもう一度押したらリセット（次のメッセージ用）
    if (sendStatus === "sent" || sendStatus === "error") {
      voiceApproval.reset();
      setSendStatus("idle");
      setSendError(null);
      return;
    }

    // 送信中は二重送信を防ぐ
    if (sendStatus === "sending") return;

    // 返信案が無い場合は承認待ち開始のみ
    if (!sessionJwtRef.current || !latestSlackMessage || !replyDraft) {
      if (voiceApproval.state === "idle") voiceApproval.startListening();
      return;
    }

    // 返信案がある場合: ボタン1クリックで即承認・送信する。
    voiceApproval.approve();
    await sendCurrentReply();
  }, [
    userInfo,
    voiceApproval,
    latestSlackMessage,
    replyDraft,
    sendStatus,
    sendCurrentReply,
  ]);

  return (
    <div className="flex flex-col h-screen bg-[#fffaf5]" data-testid="app-root">
      {/* ヘッダー */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b-2 border-[#2b1e16]">
        <SaborouIcon />
        <div className="flex-1">
          <h1 className="text-base font-bold text-[#1f2937] leading-tight">
            SABOROU
          </h1>
          <p className="text-xs text-[#6b7280]">サボりの最適解</p>
        </div>
        <NotificationSettingsMenu />
        {/* 認証状態表示 */}
        {!authLoading && (
          <div data-testid="auth-status">
            {userInfo ? (
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-1 text-xs text-[#6b7280]"
                  data-testid="user-info"
                >
                  <User size={12} />
                  <span className="max-w-[80px] truncate">{userInfo.name}</span>
                </div>
                <button
                  type="button"
                  data-testid="sign-out-button"
                  onClick={handleSignOut}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                    "border border-[#2b1e16] bg-white text-[#1f2937]",
                    "hover:bg-[#f3f4f6] transition-colors",
                  )}
                  title="サインアウト"
                >
                  <LogOut size={12} />
                  <span>ログアウト</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="sign-in-button"
                onClick={handleSignIn}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold",
                  "bg-[#f97316] text-white border-2 border-[#2b1e16]",
                  "shadow-[0_2px_0_#2b1e16] hover:bg-[#ea580c]",
                  "transition-all duration-100 active:translate-y-[2px] active:shadow-none",
                )}
              >
                <LogIn size={12} />
                <span>ログイン</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* 認証エラー表示 */}
      {authError && (
        <div
          className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
          data-testid="auth-error"
        >
          {authError}
        </div>
      )}

      {/* エージェントエラー表示 */}
      {agent.error && (
        <div
          className="mx-4 mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700"
          data-testid="agent-error"
        >
          音声接続エラー: {agent.error}
        </div>
      )}

      {/* チャットエリア */}
      <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {authLoading ? (
          <LoadingSpinner />
        ) : userInfo ? (
          <>
            <AuthenticatedWelcome
              userInfo={userInfo}
              agentStatus={agent.status}
              agentMode={agent.mode}
              lastAgentMessage={agent.lastAgentMessage}
              approvalState={voiceApproval.state}
            />
            {latestSlackMessage && (
              <SlackMessageNotificationCard message={latestSlackMessage} />
            )}
            {/* 非音声フロー: judge 状態カード */}
            {judgeStatus !== "idle" && (
              <JudgeResultCard
                status={judgeStatus}
                replyDraft={replyDraft}
                error={judgeError}
                approvalState={voiceApproval.state}
                sendStatus={sendStatus}
                sendError={sendError}
              />
            )}
          </>
        ) : (
          <UnauthenticatedMessage onSignIn={handleSignIn} />
        )}
      </main>

      {/* 承認セクション */}
      <ApprovalSection
        disabled={!userInfo}
        approvalState={voiceApproval.state}
        judgeStatus={judgeStatus}
        sendStatus={sendStatus}
        onApprovalClick={handleApprovalButtonClick}
      />

      {/* 入力エリア */}
      <ChatInputBar
        disabled={!userInfo}
        agentConnected={agent.isConnected}
        agentStatus={agent.status}
        onMicToggle={handleMicToggle}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** SABOROU キャラクターアイコン */
function SaborouIcon() {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        "w-9 h-9 rounded-xl",
        "bg-[#f97316] border-2 border-[#2b1e16]",
        "shadow-[0_3px_0_#2b1e16]",
        "text-white font-black text-sm select-none",
      )}
      aria-hidden="true"
    >
      サ
    </div>
  );
}

/** ローディングスピナー */
function LoadingSpinner() {
  return (
    <div
      className="flex items-center justify-center py-8"
      data-testid="loading-spinner"
    >
      <div className="w-8 h-8 rounded-full border-2 border-[#f97316] border-t-transparent animate-spin" />
    </div>
  );
}

/** 認証済みウェルカムメッセージ + エージェント状態 */
function AuthenticatedWelcome({
  userInfo,
  agentStatus,
  agentMode,
  lastAgentMessage,
  approvalState,
}: {
  userInfo: UserInfo;
  agentStatus: string;
  agentMode: string | null;
  lastAgentMessage: string | null;
  approvalState: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className={cn("flex gap-3")} data-testid="welcome-message">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#f97316] border-2 border-[#2b1e16] shadow-[0_2px_0_#2b1e16] flex items-center justify-center text-white font-black text-xs">
          サ
        </div>
        <div
          className={cn(
            "flex-1 p-3 rounded-xl rounded-tl-sm",
            "bg-white border-2 border-[#2b1e16]",
            "shadow-[0_3px_0_#2b1e16]",
          )}
        >
          <p className="text-sm text-[#1f2937] leading-relaxed">
            こんにちは、{userInfo.name} さん！
            <br />
            SABOROU です。Slack
            に自分宛てメッセージが届いたら、サボり判定してお返事を提案します。
          </p>
          <p className="mt-2 text-xs text-[#6b7280]">{userInfo.email}</p>
          {/* Agent status badge */}
          <div className="mt-2 flex items-center gap-1">
            <span
              className={cn(
                "inline-block w-2 h-2 rounded-full",
                agentStatus === "connected"
                  ? "bg-[#10b981]"
                  : agentStatus === "connecting"
                    ? "bg-[#f59e0b] animate-pulse"
                    : "bg-[#d1d5db]",
              )}
            />
            <span
              className="text-xs text-[#6b7280]"
              data-testid="agent-status-label"
            >
              {agentStatus === "connected"
                ? agentMode === "speaking"
                  ? "サボローが話しています"
                  : "音声接続中"
                : agentStatus === "connecting"
                  ? "接続中..."
                  : agentStatus === "unconfigured"
                    ? "音声未設定（ボタンで操作可）"
                    : "音声オフ"}
            </span>
          </div>
        </div>
      </div>

      {/* 返信文ドラフト表示エリア（音声エージェント経由） */}
      {lastAgentMessage && (
        <div className={cn("flex gap-3")} data-testid="agent-draft-area">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#f97316] border-2 border-[#2b1e16] shadow-[0_2px_0_#2b1e16] flex items-center justify-center text-white font-black text-xs">
            サ
          </div>
          <div
            className={cn(
              "flex-1 p-3 rounded-xl rounded-tl-sm",
              "bg-white border-2",
              approvalState === "awaiting_approval"
                ? "border-[#f97316] shadow-[0_3px_0_#f97316]"
                : "border-[#2b1e16] shadow-[0_3px_0_#2b1e16]",
            )}
          >
            <p className="text-xs font-semibold text-[#6b7280] mb-1">
              返信文案（音声）
            </p>
            <p
              className="text-sm text-[#1f2937] leading-relaxed"
              data-testid="reply-draft"
            >
              {lastAgentMessage}
            </p>
            {approvalState === "awaiting_approval" && (
              <p className="mt-2 text-xs text-[#f97316] font-medium animate-pulse">
                「いいよ」と言うか、下のボタンで承認してください...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** judge API の結果カード（非音声フロー） */
function JudgeResultCard({
  status,
  replyDraft,
  error,
  approvalState,
  sendStatus,
  sendError,
}: {
  status: JudgeStatus;
  replyDraft: string | null;
  error: string | null;
  approvalState: string;
  sendStatus: SendStatus;
  sendError: string | null;
}) {
  return (
    <div className={cn("flex gap-3")} data-testid="judge-result-card">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#f97316] border-2 border-[#2b1e16] shadow-[0_2px_0_#2b1e16] flex items-center justify-center text-white font-black text-xs">
        サ
      </div>
      <div
        className={cn(
          "flex-1 p-3 rounded-xl rounded-tl-sm",
          "bg-white border-2",
          status === "error"
            ? "border-red-400 shadow-[0_3px_0_#ef4444]"
            : sendStatus === "sent"
              ? "border-[#10b981] shadow-[0_3px_0_#10b981]"
              : approvalState === "awaiting_approval"
                ? "border-[#f97316] shadow-[0_3px_0_#f97316]"
                : "border-[#2b1e16] shadow-[0_3px_0_#2b1e16]",
        )}
      >
        {/* ローディング中 */}
        {status === "loading" && (
          <div className="flex items-center gap-2" data-testid="judge-loading">
            <Loader2 size={14} className="text-[#f97316] animate-spin" />
            <p className="text-xs font-medium text-[#f97316]">
              サボローが考え中...
            </p>
          </div>
        )}

        {/* エラー */}
        {status === "error" && error && (
          <div className="flex items-start gap-2" data-testid="judge-error">
            <XCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-600">
                返信案の生成に失敗しました
              </p>
              <p className="text-xs text-red-500 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* 返信案表示 */}
        {status === "ready" && replyDraft && (
          <>
            <p className="text-xs font-semibold text-[#6b7280] mb-1">
              サボローの返信案
            </p>
            <p
              className="text-sm text-[#1f2937] leading-relaxed"
              data-testid="judge-reply-draft"
            >
              {replyDraft}
            </p>

            {/* 承認待ち状態のガイダンス */}
            {approvalState === "awaiting_approval" && sendStatus === "idle" && (
              <p
                className="mt-2 text-xs text-[#f97316] font-medium animate-pulse"
                data-testid="judge-approval-hint"
              >
                「いいよ」ボタンで Slack に送信します
              </p>
            )}

            {/* 送信中 */}
            {sendStatus === "sending" && (
              <div
                className="mt-2 flex items-center gap-1"
                data-testid="send-loading"
              >
                <Loader2 size={12} className="text-[#6b7280] animate-spin" />
                <p className="text-xs text-[#6b7280]">送信中...</p>
              </div>
            )}

            {/* 送信成功 */}
            {sendStatus === "sent" && (
              <div
                className="mt-2 flex items-center gap-1"
                data-testid="send-success"
              >
                <CheckCircle size={12} className="text-[#10b981]" />
                <p className="text-xs text-[#10b981] font-medium">
                  Slack に送りました
                </p>
              </div>
            )}

            {/* 送信失敗 */}
            {sendStatus === "error" && sendError && (
              <div
                className="mt-2 flex items-start gap-1"
                data-testid="send-error"
              >
                <XCircle
                  size={12}
                  className="text-red-500 mt-0.5 flex-shrink-0"
                />
                <p className="text-xs text-red-500">{sendError}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** 未認証時のメッセージ */
function UnauthenticatedMessage({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className={cn("flex gap-3")} data-testid="unauthenticated-message">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#f97316] border-2 border-[#2b1e16] shadow-[0_2px_0_#2b1e16] flex items-center justify-center text-white font-black text-xs">
        サ
      </div>
      <div
        className={cn(
          "flex-1 p-3 rounded-xl rounded-tl-sm",
          "bg-white border-2 border-[#2b1e16]",
          "shadow-[0_3px_0_#2b1e16]",
        )}
      >
        <p className="text-sm text-[#1f2937] leading-relaxed">
          SABOROU へようこそ！
          <br />
          ログインして Slack 連携を有効にしてください。
        </p>
        <button
          type="button"
          data-testid="inline-sign-in-button"
          onClick={onSignIn}
          className={cn(
            "mt-3 w-full py-2 px-4 rounded-xl font-bold text-sm",
            "bg-[#f97316] text-white border-2 border-[#2b1e16]",
            "shadow-[0_3px_0_#2b1e16] hover:bg-[#ea580c]",
            "transition-all duration-100 active:translate-y-[3px] active:shadow-none",
          )}
        >
          Cognito でログイン
        </button>
      </div>
    </div>
  );
}

/** 承認セクション（「いいよ」ボタン — 音声フォールバック / 非音声フロー共用） */
function ApprovalSection({
  disabled,
  approvalState,
  judgeStatus,
  sendStatus,
  onApprovalClick,
}: {
  disabled?: boolean;
  approvalState: string;
  judgeStatus: JudgeStatus;
  sendStatus: SendStatus;
  onApprovalClick: () => void;
}) {
  const isApproved = approvalState === "approved";
  const isAwaiting = approvalState === "awaiting_approval";
  const isCancelled = approvalState === "cancelled";
  const isTimeout = approvalState === "timeout";
  const isSent = sendStatus === "sent";
  const isSending = sendStatus === "sending";

  let label = "いいよ";
  if (disabled) label = "ログインして承認を有効化";
  else if (isSent) label = "✓ 送りました";
  else if (isSending) label = "送信中...";
  else if (isApproved) label = "✓ 承認済み";
  else if (isAwaiting && judgeStatus === "ready") label = "いいよ → Slack 送信";
  else if (isAwaiting) label = "「いいよ」待機中...";
  else if (isCancelled) label = "✗ キャンセル";
  else if (isTimeout) label = "タイムアウト";

  const isDisabledState = disabled || isSending || isSent;

  return (
    <div
      className="px-4 py-3 border-t-2 border-[#f3f4f6] bg-[#fffaf5]"
      data-testid="approval-section"
    >
      <p className="text-xs text-[#6b7280] mb-2 font-medium">
        承認アクション（音声「いいよ」またはボタン）
      </p>
      <button
        type="button"
        data-testid="approval-button"
        onClick={isDisabledState ? undefined : onApprovalClick}
        disabled={isDisabledState}
        className={cn(
          "w-full py-3 px-4 rounded-xl font-bold text-sm",
          "border-2 border-[#2b1e16] transition-all duration-100",
          isDisabledState
            ? isSent
              ? "bg-[#10b981] text-white shadow-none translate-y-[4px]"
              : "bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed shadow-none"
            : isApproved
              ? "bg-[#10b981] text-white shadow-none translate-y-[4px]"
              : isAwaiting
                ? "bg-[#f97316] text-white shadow-[0_4px_0_#2b1e16] hover:bg-[#ea580c] active:translate-y-[4px] active:shadow-none"
                : isCancelled || isTimeout
                  ? "bg-[#6b7280] text-white shadow-none translate-y-[2px]"
                  : "bg-[#f97316] text-white shadow-[0_4px_0_#2b1e16] hover:bg-[#ea580c]",
        )}
      >
        {label}
      </button>
    </div>
  );
}

/** Slack 新着メッセージ通知カード（content script から受信） */
function SlackMessageNotificationCard({
  message,
}: {
  message: SlackMessageNotification;
}) {
  const time = new Date(message.detectedAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={cn("flex gap-3")} data-testid="slack-message-notification">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#4a154b] border-2 border-[#2b1e16] shadow-[0_2px_0_#2b1e16] flex items-center justify-center text-white font-black text-xs">
        S
      </div>
      <div
        className={cn(
          "flex-1 p-3 rounded-xl rounded-tl-sm",
          "bg-white border-2 border-[#4a154b]",
          "shadow-[0_3px_0_#4a154b]",
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-[#4a154b]">
            Slack 新着 — {message.sender}
          </p>
          <span className="text-xs text-[#9ca3af]">{time}</span>
        </div>
        <p
          className="text-sm text-[#1f2937] leading-relaxed"
          data-testid="slack-message-text"
        >
          {message.text}
        </p>
        <p className="mt-1 text-xs text-[#9ca3af]">
          チャンネル: {message.channelId}
        </p>
      </div>
    </div>
  );
}

/** チャット入力バー（マイクボタン有効化） */
function ChatInputBar({
  disabled,
  agentConnected,
  agentStatus,
  onMicToggle,
}: {
  disabled?: boolean;
  agentConnected: boolean;
  agentStatus: string;
  onMicToggle: () => void;
}) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    setInput("");
  };

  const micDisabled = disabled || agentStatus === "unconfigured";
  const micConnecting = agentStatus === "connecting";

  return (
    <div
      className="px-4 pb-4 pt-2 bg-white border-t-2 border-[#2b1e16]"
      data-testid="chat-input-bar"
    >
      <div className="flex gap-2 items-center">
        {/* マイクボタン — U-V2-03 で機能有効化 */}
        <button
          type="button"
          data-testid="mic-button"
          disabled={micDisabled}
          onClick={micDisabled ? undefined : onMicToggle}
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-xl",
            "border-2 flex items-center justify-center",
            "transition-all duration-100",
            micDisabled
              ? "border-[#d1d5db] bg-[#f9fafb] text-[#9ca3af] cursor-not-allowed"
              : agentConnected
                ? "border-[#10b981] bg-[#d1fae5] text-[#059669] shadow-[0_2px_0_#059669] hover:bg-[#a7f3d0]"
                : micConnecting
                  ? "border-[#f59e0b] bg-[#fef3c7] text-[#d97706] animate-pulse cursor-wait"
                  : "border-[#2b1e16] bg-white text-[#1f2937] shadow-[0_2px_0_#2b1e16] hover:bg-[#f3f4f6]",
          )}
          title={
            micDisabled
              ? agentStatus === "unconfigured"
                ? "音声未設定"
                : "ログインしてください"
              : agentConnected
                ? "音声切断"
                : "音声接続"
          }
        >
          {agentConnected ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        {/* テキスト入力 */}
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={disabled}
            placeholder={
              disabled ? "ログインしてください" : "メッセージを入力..."
            }
            className={cn(
              "flex-1 px-3 py-2 text-sm rounded-xl",
              "border-2 border-[#2b1e16] outline-none",
              "bg-white text-[#1f2937]",
              "placeholder:text-[#9ca3af]",
              "focus:border-[#f97316]",
              disabled && "bg-[#f9fafb] cursor-not-allowed",
            )}
          />
          <button
            type="button"
            data-testid="send-button"
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-xl",
              "border-2 border-[#2b1e16]",
              "flex items-center justify-center font-bold",
              "transition-all duration-100",
              input.trim() && !disabled
                ? "bg-[#f97316] text-white shadow-[0_3px_0_#2b1e16] hover:bg-[#ea580c] active:translate-y-[3px] active:shadow-none"
                : "bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed",
            )}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-[#9ca3af] flex items-center gap-1">
        <MessageCircle size={11} />
        {agentConnected
          ? "音声入力受付中 — 話しかけてください"
          : "マイクボタンで音声接続"}
      </p>
    </div>
  );
}
