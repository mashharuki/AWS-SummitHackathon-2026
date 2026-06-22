/**
 * SaborouContext — 4タブ間で共有する状態とアクション
 *
 * 認証 JWT・タスク候補・承認済みタスク・選択中タスク・content script への
 * DOM 送信を集約する。各タブはこの Context を参照してデータを描画する。
 *
 * Slack 送信は「DOM スクレイピング送信を正」とする設計判断に従い、
 * sendSlackViaDom() が content script に SEND_SLACK_REPLY を投げて
 * 隣の Slack ブラウザタブへ自分のアカウントとして投稿する。
 */

import type { NewSlackMessagePayload } from "@/messages";
import {
  getCandidates,
  getProposal,
  getTaskSummaries,
} from "@/panel/lib/agentClient";
import type { Proposal, TaskCandidate, TaskSummary } from "@/panel/lib/types";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface UserInfo {
  sub: string;
  email: string;
  name: string;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

/** 余白タブのサボローチャット 1 発話 */
export interface ChatMessage {
  id: string;
  role: "user" | "saborou";
  text: string;
}

interface SaborouContextValue {
  userInfo: UserInfo | null;
  jwt: string | null;

  /** タスク候補一覧（candidates API + content 検知のマージ済み） */
  candidates: TaskCandidate[];
  candidatesLoading: boolean;
  refreshCandidates: () => Promise<void>;
  removeCandidate: (candidateId: string) => void;

  /** 承認済みタスク一覧 */
  tasks: TaskSummary[];
  tasksLoading: boolean;
  refreshTasks: () => Promise<void>;

  /** 直近の代表 proposal（ホームの psychSignals 用） */
  representativeProposal: Proposal | null;

  /** content script 検知の最新 Slack メッセージ（リアルタイム新着） */
  latestSlackMessage: NewSlackMessagePayload | null;

  /**
   * content script 経由で Slack DOM に返信を送信する（自分のアカウント送信）。
   * 隣の Slack ブラウザタブに自動入力 + 送信ボタンクリックを行う。
   */
  sendSlackViaDom: (text: string) => Promise<SendResult>;

  /** 完了通知（デスクトップ通知）を background に依頼する */
  notifyReplyCompleted: () => void;

  /** 余白タブのサボローチャット履歴 */
  chatMessages: ChatMessage[];
  /** ユーザー発話を投稿する（応答もここで生成して履歴に積む） */
  postChatMessage: (text: string) => void;
}

const SaborouContext = createContext<SaborouContextValue | null>(null);

/** 1日前より古い候補を除外する（ISO8601 detectedAt ベース） */
function isWithinOneDay(detectedAt?: string): boolean {
  if (!detectedAt) return true; // detectedAt なし（APIから来た古い形式）は表示する
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return new Date(detectedAt).getTime() >= oneDayAgo;
}

/** content 検知の Slack メッセージを TaskCandidate 形に変換する */
function slackMessageToCandidate(msg: NewSlackMessagePayload): TaskCandidate {
  return {
    candidateId: `live:${msg.threadTs || `${msg.channelId}:${msg.text.slice(0, 24)}`}`,
    title: msg.text.slice(0, 60),
    deadline: null,
    requester: msg.sender,
    description: msg.text,
    sourceType: "slack",
    slackChannelId: msg.channelId,
    threadTs: msg.threadTs || undefined,
    detectedAt: new Date().toISOString(),
  };
}

/** candidates(API) と live(content 検知) を dedupe マージする */
export function mergeCandidates(
  apiCandidates: TaskCandidate[],
  liveMessages: NewSlackMessagePayload[],
): TaskCandidate[] {
  const seen = new Set<string>();
  const result: TaskCandidate[] = [];

  // live を先頭（新着優先）
  for (const msg of liveMessages) {
    const cand = slackMessageToCandidate(msg);
    const key = (cand.threadTs || cand.description.slice(0, 40)).trim();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cand);
  }
  for (const cand of apiCandidates) {
    const key = (cand.threadTs || cand.description.slice(0, 40)).trim();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cand);
  }
  return result;
}

export function SaborouProvider({
  userInfo,
  jwt,
  latestSlackMessage,
  children,
}: {
  userInfo: UserInfo | null;
  jwt: string | null;
  latestSlackMessage: NewSlackMessagePayload | null;
  children: ReactNode;
}) {
  const [apiCandidates, setApiCandidates] = useState<TaskCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [representativeProposal, setRepresentativeProposal] =
    useState<Proposal | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  // content 検知メッセージを履歴として蓄積（最新数件）
  const liveMessagesRef = useRef<NewSlackMessagePayload[]>([]);
  const [liveMessages, setLiveMessages] = useState<NewSlackMessagePayload[]>(
    [],
  );

  useEffect(() => {
    if (!latestSlackMessage) return;
    const key =
      latestSlackMessage.threadTs ||
      `${latestSlackMessage.channelId}:${latestSlackMessage.text.slice(0, 24)}`;
    const exists = liveMessagesRef.current.some(
      (m) => (m.threadTs || `${m.channelId}:${m.text.slice(0, 24)}`) === key,
    );
    if (exists) return;
    const next = [latestSlackMessage, ...liveMessagesRef.current].slice(0, 10);
    liveMessagesRef.current = next;
    setLiveMessages(next);
  }, [latestSlackMessage]);

  const refreshCandidates = useCallback(async () => {
    if (!jwt) return;
    setCandidatesLoading(true);
    try {
      const list = await getCandidates(jwt);
      // detectedAt が未付与のものはフロント受取時刻を付与
      const now = new Date().toISOString();
      setApiCandidates(
        list.map((c) => (c.detectedAt ? c : { ...c, detectedAt: now })),
      );
    } catch (err) {
      console.warn("[SABOROU] refreshCandidates failed:", err);
    } finally {
      setCandidatesLoading(false);
    }
  }, [jwt]);

  const refreshTasks = useCallback(async () => {
    if (!jwt) return;
    setTasksLoading(true);
    try {
      const list = await getTaskSummaries(jwt);
      setTasks(list);
      // 代表 proposal をホーム指標用に1件取得（最初の未完了タスク）
      const target = list[0];
      if (target) {
        const p = await getProposal(target.taskId, jwt);
        if (p) setRepresentativeProposal(p);
      }
    } catch (err) {
      console.warn("[SABOROU] refreshTasks failed:", err);
    } finally {
      setTasksLoading(false);
    }
  }, [jwt]);

  // 初回ロード
  useEffect(() => {
    if (jwt) {
      void refreshCandidates();
      void refreshTasks();
    }
  }, [jwt, refreshCandidates, refreshTasks]);

  const removeCandidate = useCallback((candidateId: string) => {
    setRemovedIds((prev) => new Set(prev).add(candidateId));
  }, []);

  const candidates = useMemo(() => {
    const merged = mergeCandidates(apiCandidates, liveMessages);
    return merged.filter(
      (c) => !removedIds.has(c.candidateId) && isWithinOneDay(c.detectedAt),
    );
  }, [apiCandidates, liveMessages, removedIds]);

  const sendSlackViaDom = useCallback((text: string): Promise<SendResult> => {
    return new Promise((resolve) => {
      chrome.runtime
        .sendMessage({ type: "SEND_SLACK_REPLY", text })
        .then((res: SendResult | undefined) => {
          if (res?.ok) {
            resolve({ ok: true });
          } else {
            resolve({
              ok: false,
              error:
                res?.error ??
                "Slack タブが見つかりませんでした。隣のブラウザで app.slack.com を開いてください。",
            });
          }
        })
        .catch((err: unknown) => {
          resolve({
            ok: false,
            error:
              err instanceof Error ? err.message : "DOM 送信に失敗しました",
          });
        });
    });
  }, []);

  const notifyReplyCompleted = useCallback(() => {
    chrome.runtime
      .sendMessage({ type: "TASK_REPLY_COMPLETED" })
      .catch((err: unknown) => {
        console.warn("[SABOROU] Completion notification failed:", err);
      });
  }, []);

  // ---------------------------------------------------------------------------
  // 余白タブのサボローチャット
  // テキストチャット専用バックエンドは未提供のため、応答は代表 proposal の
  // chatMessage / reasoning をフォールバックとして返す。
  // ---------------------------------------------------------------------------
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatSeqRef = useRef(0);

  const postChatMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userId = `u${chatSeqRef.current++}`;
      const saborouId = `s${chatSeqRef.current++}`;

      const reply =
        representativeProposal?.chatMessage ??
        (representativeProposal?.reasoning?.[0]
          ? `${representativeProposal.reasoning[0]} なので、いまは少し休んでも大丈夫だよ。`
          : "いまの状況だと、その件は急ぎじゃなさそうだよ。少し余白を作っても後続には影響しないはず。");

      setChatMessages((prev) => [
        ...prev,
        { id: userId, role: "user", text: trimmed },
        { id: saborouId, role: "saborou", text: reply },
      ]);
    },
    [representativeProposal],
  );

  const value = useMemo<SaborouContextValue>(
    () => ({
      userInfo,
      jwt,
      candidates,
      candidatesLoading,
      refreshCandidates,
      removeCandidate,
      tasks,
      tasksLoading,
      refreshTasks,
      representativeProposal,
      latestSlackMessage,
      sendSlackViaDom,
      notifyReplyCompleted,
      chatMessages,
      postChatMessage,
    }),
    [
      userInfo,
      jwt,
      candidates,
      candidatesLoading,
      refreshCandidates,
      removeCandidate,
      tasks,
      tasksLoading,
      refreshTasks,
      representativeProposal,
      latestSlackMessage,
      sendSlackViaDom,
      notifyReplyCompleted,
      chatMessages,
      postChatMessage,
    ],
  );

  return (
    <SaborouContext.Provider value={value}>{children}</SaborouContext.Provider>
  );
}

export function useSaborou(): SaborouContextValue {
  const ctx = useContext(SaborouContext);
  if (!ctx) {
    throw new Error("useSaborou must be used within SaborouProvider");
  }
  return ctx;
}
