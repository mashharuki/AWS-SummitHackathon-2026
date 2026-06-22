/**
 * SABOROU Side Panel App — 4タブ shell（U-V4-01）
 *
 * 認証（Cognito PKCE）と content script からの Slack 新着受信を担い、
 * SaborouProvider で共有状態を配下のタブに供給する。
 *
 * タブ構成（プロダクトストーリー 6ステップ → 4タブ）:
 *   ホーム(現状把握) / 依頼整理(受け機嫌) / 作業中(タスク代行) / 余白(理由生成・フリ・使い道)
 *
 * 旧 v2 の単一フロー（judge → 承認 → 送信）と音声「いいよ」承認は依頼整理タブの
 * 承認モーダルへ統合済み。Slack 送信は DOM スクレイピング（自分のアカウント）を正とする。
 */

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
import {
  SaborouProvider,
  type UserInfo,
  useSaborou,
} from "@/panel/SaborouContext";
import { TabBar, type TabId } from "@/panel/components/TabBar";
import { useConversationalAgent } from "@/panel/hooks/useConversationalAgent";
import { HomeTab } from "@/panel/tabs/HomeTab";
import { InboxTab } from "@/panel/tabs/InboxTab";
import { SlackTab } from "@/panel/tabs/SlackTab";
import { WorkingTab } from "@/panel/tabs/WorkingTab";
import { ArrowRight, LogIn, LogOut, Mic, MicOff, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function App() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [sessionJwt, setSessionJwt] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [latestSlackMessage, setLatestSlackMessage] =
    useState<NewSlackMessagePayload | null>(null);

  // 音声エージェント（ElevenLabs）。マイクトグルで接続し、各タブの承認で
  // 「いいよ」音声フレーズを使えるようにするためのグローバルセッション。
  const agent = useConversationalAgent({ sessionJwt });

  // ---------------------------------------------------------------------------
  // content script bridge: Slack 新着メッセージ受信
  // ---------------------------------------------------------------------------

  const handleNewSlackMessage = useCallback(
    (payload: NewSlackMessagePayload) => {
      setLatestSlackMessage(payload);
      // 新着が来たら依頼整理タブへ誘導
      setActiveTab((prev) => (prev === "home" ? "inbox" : prev));
    },
    [],
  );

  useEffect(() => {
    const listener = (message: ExtensionRuntimeMessage) => {
      if (message.type === "NEW_SLACK_MESSAGE") {
        handleNewSlackMessage(message.payload);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [handleNewSlackMessage]);

  // Side Panel ↔ background のポート接続（windowId 記憶用）
  useEffect(() => {
    const port = chrome.runtime.connect({ name: SIDE_PANEL_PORT_NAME });
    chrome.windows
      .getCurrent()
      .then((currentWindow) => {
        port.postMessage({
          type: "PANEL_READY",
          windowId: currentWindow.id,
        } satisfies SidePanelReadyMessage);
      })
      .catch(() => {
        port.postMessage({
          type: "PANEL_READY",
        } satisfies SidePanelReadyMessage);
      });
    return () => port.disconnect();
  }, []);

  // 起動時、background に溜まっていた pending タスクを取り込む
  useEffect(() => {
    if (authLoading) return;
    chrome.runtime
      .sendMessage({ type: "GET_PENDING_TASK" })
      .then((response: PendingTaskResponse | undefined) => {
        if (response?.task) handleNewSlackMessage(response.task);
      })
      .catch((err: unknown) => {
        console.warn("[SABOROU] Failed to restore pending task:", err);
      });
  }, [authLoading, handleNewSlackMessage]);

  // ---------------------------------------------------------------------------
  // 認証
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
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-screen bg-[#fffaf5]" data-testid="app-root">
      {/* ヘッダー */}
      <header className="flex items-center gap-2 px-3 py-2.5 bg-white border-b-2 border-[#2b1e16]">
        <SaborouIcon />
        <div className="flex-1">
          <h1 className="text-sm font-black text-[#1f2937] leading-tight">
            Saborou
          </h1>
        </div>
        <NotificationSettingsMenu jwt={sessionJwt} />
        {!authLoading && (
          <div data-testid="auth-status">
            {userInfo ? (
              <div className="flex items-center gap-1.5">
                {/* 音声トグル（ElevenLabs。未設定時は無効） */}
                <button
                  type="button"
                  data-testid="mic-button"
                  disabled={agent.status === "unconfigured"}
                  onClick={() =>
                    agent.isConnected ? agent.disconnect() : agent.connect()
                  }
                  className={cn(
                    "p-1.5 rounded-lg border transition-colors",
                    agent.status === "unconfigured"
                      ? "border-[#e5e7eb] bg-[#f9fafb] text-[#9ca3af] cursor-not-allowed"
                      : agent.isConnected
                        ? "border-[#10b981] bg-[#d1fae5] text-[#059669]"
                        : "border-[#2b1e16] bg-white text-[#1f2937] hover:bg-[#f3f4f6]",
                  )}
                  title={
                    agent.status === "unconfigured"
                      ? "音声未設定"
                      : agent.isConnected
                        ? "音声切断"
                        : "音声接続"
                  }
                >
                  {agent.isConnected ? <MicOff size={12} /> : <Mic size={12} />}
                </button>
                <div
                  className="flex items-center gap-1 text-[10px] text-[#6b7280]"
                  data-testid="user-info"
                >
                  <User size={11} />
                  <span className="max-w-[56px] truncate">{userInfo.name}</span>
                </div>
                <button
                  type="button"
                  data-testid="sign-out-button"
                  onClick={handleSignOut}
                  className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[10px] font-bold border border-[#2b1e16] bg-white text-[#1f2937] hover:bg-[#f3f4f6]"
                  title="サインアウト"
                >
                  <LogOut size={11} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="sign-in-button"
                onClick={handleSignIn}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#f97316] text-white border-2 border-[#2b1e16] shadow-[0_2px_0_#2b1e16] hover:bg-[#ea580c] active:translate-y-[2px] active:shadow-none"
              >
                <LogIn size={11} />
                ログイン
              </button>
            )}
          </div>
        )}
      </header>

      {authError && (
        <div
          className="mx-3 mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
          data-testid="auth-error"
        >
          {authError}
        </div>
      )}

      {authLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-8 h-8 rounded-full border-2 border-[#f97316] border-t-transparent animate-spin"
            data-testid="loading-spinner"
          />
        </div>
      ) : userInfo && sessionJwt ? (
        <SaborouProvider
          userInfo={userInfo}
          jwt={sessionJwt}
          latestSlackMessage={latestSlackMessage}
        >
          <TabContent activeTab={activeTab} onTabChange={setActiveTab} />
        </SaborouProvider>
      ) : (
        <UnauthenticatedMessage onSignIn={handleSignIn} />
      )}
    </div>
  );
}

/**
 * タブバー（上部）+ タブ本体 + 全タブ共通の固定チャットバー（下部）。
 * チャットバーに送信すると余白(slack)タブへ自動遷移し、会話に積む。
 */
function TabContent({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
}) {
  // 依頼整理の件数バッジ・チャット投稿は Context から取得（Provider 配下）
  const { candidates, postChatMessage } = useSaborou();

  const handleChatSend = useCallback(
    (text: string) => {
      postChatMessage(text);
      // どのタブで打っても、会話が見える余白タブへ自動で移動する
      onTabChange("slack");
    },
    [postChatMessage, onTabChange],
  );

  return (
    <>
      {/* タブバーは上部 */}
      <TabBar
        active={activeTab}
        onChange={onTabChange}
        inboxCount={candidates.length}
      />

      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "home" && <HomeTab />}
        {activeTab === "inbox" && (
          <InboxTab onDelegationStart={() => onTabChange("working")} />
        )}
        {activeTab === "working" && <WorkingTab />}
        {activeTab === "slack" && <SlackTab />}
      </div>

      {/* 全タブ共通の固定チャットバー（下部） */}
      <GlobalChatBar onSend={handleChatSend} />
    </>
  );
}

/** 全タブ共通・下部固定のチャット入力欄 */
function GlobalChatBar({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 border-t-2 border-[#2b1e16] bg-white"
      data-testid="global-chat-bar"
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="サボろうについて質問..."
        data-testid="chat-input"
        className="flex-1 px-3 py-2 rounded-full text-sm border-2 border-[#2b1e16] outline-none focus:border-[#f97316] bg-white text-[#1f2937] placeholder:text-[#9ca3af]"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!text.trim()}
        aria-label="送信"
        data-testid="chat-send"
        className={cn(
          "flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-white border-2 border-[#2b1e16] shadow-[0_2px_0_#2b1e16] transition-all",
          text.trim()
            ? "bg-[#f97316] hover:bg-[#ea580c] active:translate-y-[2px] active:shadow-none"
            : "bg-[#e5e7eb] border-[#d1d5db] shadow-none cursor-not-allowed",
        )}
      >
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SaborouIcon() {
  return (
    <div
      className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#f97316] border-2 border-[#2b1e16] shadow-[0_3px_0_#2b1e16] text-white font-black text-sm select-none"
      aria-hidden="true"
    >
      サ
    </div>
  );
}

function UnauthenticatedMessage({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div
        className="w-full p-4 rounded-2xl bg-white border-2 border-[#2b1e16] shadow-[0_3px_0_#2b1e16]"
        data-testid="unauthenticated-message"
      >
        <div className="flex items-center gap-2 mb-2">
          <SaborouIcon />
          <p className="text-sm font-black text-[#1f2937]">SABOROU</p>
        </div>
        <p className="text-sm text-[#1f2937] leading-relaxed">
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
