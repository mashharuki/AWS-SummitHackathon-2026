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
  decomposeTask,
  getCandidates,
  getGoalAnalysis,
  getProposal,
  getSchedule,
  getTaskSummaries,
} from "@/panel/lib/agentClient";
import type {
  GoalAnalysis,
  Proposal,
  TaskCandidate,
  TaskSummary,
} from "@/panel/lib/types";
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
  action?: "progress_report" | "watch_video";
}

export interface FreeTimeSession {
  task: TaskSummary | null;
  nextTask: TaskSummary | null;
  goalAnalysis: GoalAnalysis | null;
  freeMinutes: number | null;
  suggestion: string;
  recoveryCheckLabel: string | null;
  loading: boolean;
  error: string | null;
}

interface SaborouContextValue {
  userInfo: UserInfo | null;
  jwt: string | null;

  /** タスク候補一覧（candidates API + content 検知のマージ済み） */
  candidates: TaskCandidate[];
  candidatesLoading: boolean;
  candidatesError: boolean;
  refreshCandidates: () => Promise<void>;
  removeCandidate: (candidateId: string) => void;

  /** 承認済みタスク一覧 */
  tasks: TaskSummary[];
  tasksLoading: boolean;
  tasksError: boolean;
  refreshTasks: () => Promise<void>;

  /** 直近の代表 proposal（ホームの psychSignals 用） */
  representativeProposal: Proposal | null;
  /** スケジュールAPIから取得したsaboriバンドの合計分数（null=未取得） */
  scheduleSaboruMinutes: number | null;
  /** 余白タブで使う対象タスク・余白提案・復帰先の合成状態 */
  freeTimeSession: FreeTimeSession;

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
  /** システムイベント由来のサボロー発話を投稿する */
  postSaborouMessage: (text: string) => void;
  /** 進捗報告代行の初回発動後に、次のサボり方を提案する */
  offerVideoContinuation: () => void;

  /** PM WBS分解結果（WorkingTabが取得・SlackTabが参照） */
  goalAnalysis: GoalAnalysis | null;
  /** PM WBS分解結果をセットする（WorkingTabから呼ばれる） */
  setGoalAnalysis: (ga: GoalAnalysis | null) => void;

  /** 最後に代行依頼されたタスクID（WorkingTabが表示対象タスクを決定するために使用） */
  delegatedTaskId: string | null;
  setDelegatedTaskId: (id: string | null) => void;
  registerDelegatedTask: (task: TaskSummary) => void;
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

function getTaskStartLabel(task: TaskSummary | null): string | null {
  if (!task?.deadline) return null;
  const date = new Date(task.deadline);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function findNextTask(
  tasks: TaskSummary[],
  targetTask: TaskSummary | null,
): TaskSummary | null {
  const now = Date.now();
  return (
    tasks
      .filter((task) => task.taskId !== targetTask?.taskId)
      .map((task) => ({
        task,
        deadlineMs: task.deadline
          ? new Date(task.deadline).getTime()
          : Number.POSITIVE_INFINITY,
      }))
      .filter(
        ({ deadlineMs }) => Number.isFinite(deadlineMs) && deadlineMs > now,
      )
      .sort((a, b) => a.deadlineMs - b.deadlineMs)[0]?.task ?? null
  );
}

function buildFreeTimeSuggestion(
  goalAnalysis: GoalAnalysis | null,
  proposal: Proposal | null,
): string {
  if (goalAnalysis?.freeTimeSuggestion) return goalAnalysis.freeTimeSuggestion;
  if (proposal?.chatMessage) return proposal.chatMessage;
  if (proposal?.reasoning?.[0]) {
    return `今は少し肩の力を抜いて大丈夫。${proposal.reasoning[0]}`;
  }
  return "次の予定までの余白を確認しています。急ぎの予定が見つからなければ、短く休んでから戻れるように整えます。";
}

function buildSaborouChatReply(
  text: string,
  proposal: Proposal | null,
  freeTimeSession: FreeTimeSession,
): string {
  const normalized = text.toLowerCase();
  const asksToSaboru =
    text.includes("サボ") ||
    text.includes("さぼ") ||
    normalized.includes("saborou");
  const asksForCompletedMargin =
    (text.includes("終わ") || text.includes("完了") || text.includes("終え")) &&
    (text.includes("余白") || text.includes("休") || text.includes("サボ"));
  const asksForTransition =
    text.includes("切り替") ||
    text.includes("戻") ||
    text.includes("復帰") ||
    text.includes("19時") ||
    normalized.includes("task") ||
    normalized.includes("back");

  if (asksForCompletedMargin) {
    const taskTitle = freeTimeSession.task?.title ?? "いまのタスク";
    const nextLabel = freeTimeSession.nextTask
      ? `${freeTimeSession.nextTask.title}${getTaskStartLabel(freeTimeSession.nextTask) ? `（${getTaskStartLabel(freeTimeSession.nextTask)}開始）` : ""}`
      : "次の予定は未検出";
    const minutes =
      freeTimeSession.freeMinutes !== null
        ? `残り${freeTimeSession.freeMinutes}分。`
        : "余白時間はまだ確定していないけど、";
    return `よく頑張ったよ。${taskTitle}、ここまで進めたね。${nextLabel}まで、${minutes}${freeTimeSession.suggestion}`;
  }

  if (asksToSaboru) {
    const helper =
      proposal?.reasoning?.[0] &&
      !freeTimeSession.suggestion.includes(proposal.reasoning[0])
        ? ` ${proposal.reasoning[0]}`
        : "";
    return `${freeTimeSession.suggestion}${helper} 必要なら、このタスクの進捗報告もこっちで整えるよ。`;
  }

  if (asksForTransition) {
    if (!freeTimeSession.nextTask) {
      return "次の予定はまだ見つかっていないよ。余白を区切って、戻る前に次に開く資料だけ決めておこう。";
    }
    const startLabel = getTaskStartLabel(freeTimeSession.nextTask);
    const startText = startLabel ? `${startLabel}開始` : "開始時刻未設定";
    return `${freeTimeSession.nextTask.title}に戻る準備だね。${startText}だから、10分前に関連資料を開いて、5分前に最初の15分でやることを3つに絞ろう。開始したら最初の一手だけ一緒に切る。`;
  }

  if (proposal?.chatMessage) return proposal.chatMessage;

  if (proposal?.reasoning?.[0]) {
    return `お、理由はちゃんとあるぞ。${proposal.reasoning[0]} だから、今は少し肩の力抜いて大丈夫。罪悪感は俺が持っとく。`;
  }

  return "お、今の状況だとその件は急ぎじゃなさそうだな。少し余白を作っても後続には響かないはず。ここは俺が見とくから、肩の力抜こっか。";
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
  const [candidatesError, setCandidatesError] = useState(false);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const delegatedTaskRef = useRef<TaskSummary | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState(false);
  const [representativeProposal, setRepresentativeProposal] =
    useState<Proposal | null>(null);
  const [scheduleSaboruMinutes, setScheduleSaboruMinutes] = useState<
    number | null
  >(null);
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
    setCandidatesError(false);
    try {
      const list = await getCandidates(jwt);
      // detectedAt が未付与のものはフロント受取時刻を付与
      const now = new Date().toISOString();
      setApiCandidates(
        list.map((c) => (c.detectedAt ? c : { ...c, detectedAt: now })),
      );
    } catch (err) {
      console.warn("[SABOROU] refreshCandidates failed:", err);
      setCandidatesError(true);
    } finally {
      setCandidatesLoading(false);
    }
  }, [jwt]);

  const refreshTasks = useCallback(async () => {
    if (!jwt) return;
    setTasksLoading(true);
    setTasksError(false);
    try {
      const list = await getTaskSummaries(jwt);
      const delegatedTask = delegatedTaskRef.current;
      const delegatedTaskSynced = delegatedTask
        ? list.some((t) => t.taskId === delegatedTask.taskId)
        : false;
      if (delegatedTaskSynced && delegatedTask) {
        delegatedTaskRef.current = null;
        setDelegatedTaskId((current) =>
          current === delegatedTask.taskId ? null : current,
        );
      }
      const mergedList =
        delegatedTask && !delegatedTaskSynced ? [delegatedTask, ...list] : list;
      setTasks(mergedList);
      // 代表 proposal をホーム指標用に1件取得（最初の未完了タスク）
      const target = mergedList[0];
      if (target) {
        const [p, s] = await Promise.all([
          getProposal(target.taskId, jwt),
          getSchedule(target.taskId, jwt),
        ]);
        if (p) setRepresentativeProposal(p);
        if (s) setScheduleSaboruMinutes(s.totalSaboruMinutes);
      }
    } catch (err) {
      console.warn("[SABOROU] refreshTasks failed:", err);
      setTasksError(true);
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
            const raw =
              res?.error ??
              "Slack タブが見つかりませんでした。app.slack.com を開いてください。";
            resolve({
              ok: false,
              error: raw.includes("Could not establish connection")
                ? "Slack タブを更新してください（拡張機能の再読み込み後は Slack ページの更新が必要です）"
                : raw,
            });
          }
        })
        .catch((err: unknown) => {
          const msg =
            err instanceof Error ? err.message : "DOM 送信に失敗しました";
          resolve({
            ok: false,
            error: msg.includes("Could not establish connection")
              ? "Slack タブを更新してください（拡張機能の再読み込み後は Slack ページの更新が必要です）"
              : msg,
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

  // PM WBS分解結果（WorkingTab ↔ SlackTab 共有）
  const [goalAnalysis, setGoalAnalysis] = useState<GoalAnalysis | null>(null);
  const [delegatedTaskId, setDelegatedTaskId] = useState<string | null>(null);
  const registerDelegatedTask = useCallback((task: TaskSummary) => {
    delegatedTaskRef.current = task;
    setTasks((prev) => [task, ...prev.filter((t) => t.taskId !== task.taskId)]);
    setDelegatedTaskId(task.taskId);
  }, []);

  const targetTask =
    (delegatedTaskId
      ? tasks.find((task) => task.taskId === delegatedTaskId)
      : tasks[0]) ?? null;
  const nextTask = useMemo(
    () => findNextTask(tasks, targetTask),
    [tasks, targetTask],
  );
  const [freeTimeGoalAnalysis, setFreeTimeGoalAnalysis] =
    useState<GoalAnalysis | null>(null);
  const [freeTimeLoading, setFreeTimeLoading] = useState(false);
  const [freeTimeError, setFreeTimeError] = useState<string | null>(null);
  const freeTimeFetchedTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!jwt || !targetTask) {
      setFreeTimeGoalAnalysis(null);
      setFreeTimeLoading(false);
      setFreeTimeError(null);
      freeTimeFetchedTaskIdRef.current = null;
      return;
    }

    if (goalAnalysis) {
      setFreeTimeGoalAnalysis(goalAnalysis);
      setFreeTimeLoading(false);
      setFreeTimeError(null);
      freeTimeFetchedTaskIdRef.current = targetTask.taskId;
      return;
    }

    if (freeTimeFetchedTaskIdRef.current === targetTask.taskId) return;
    freeTimeFetchedTaskIdRef.current = targetTask.taskId;
    let cancelled = false;
    setFreeTimeLoading(true);
    setFreeTimeError(null);

    const resolveGoalAnalysis = async () => {
      const existing = await getGoalAnalysis(targetTask.taskId, jwt);
      if (existing) return existing;
      return decomposeTask(targetTask.taskId, jwt);
    };

    resolveGoalAnalysis()
      .then((analysis) => {
        if (cancelled) return;
        setFreeTimeGoalAnalysis(analysis);
        setGoalAnalysis(analysis);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.warn("[SABOROU] free time session failed:", err);
        setFreeTimeGoalAnalysis(null);
        setFreeTimeError("余白提案を取得できませんでした");
        freeTimeFetchedTaskIdRef.current = null;
      })
      .finally(() => {
        if (!cancelled) setFreeTimeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jwt, targetTask, goalAnalysis]);

  const freeTimeSession = useMemo<FreeTimeSession>(() => {
    const sessionGoalAnalysis = goalAnalysis ?? freeTimeGoalAnalysis;
    const analysisMinutes = sessionGoalAnalysis?.freeTimeMinutes;
    const freeMinutes =
      typeof analysisMinutes === "number" && analysisMinutes > 0
        ? analysisMinutes
        : scheduleSaboruMinutes && scheduleSaboruMinutes > 0
          ? scheduleSaboruMinutes
          : null;
    const nextStartLabel = getTaskStartLabel(nextTask);

    return {
      task: targetTask,
      nextTask,
      goalAnalysis: sessionGoalAnalysis,
      freeMinutes,
      suggestion: buildFreeTimeSuggestion(
        sessionGoalAnalysis,
        representativeProposal,
      ),
      recoveryCheckLabel: nextStartLabel,
      loading: freeTimeLoading,
      error: freeTimeError,
    };
  }, [
    targetTask,
    nextTask,
    goalAnalysis,
    freeTimeGoalAnalysis,
    scheduleSaboruMinutes,
    representativeProposal,
    freeTimeLoading,
    freeTimeError,
  ]);

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

      const reply = buildSaborouChatReply(
        trimmed,
        representativeProposal,
        freeTimeSession,
      );
      const shouldOfferProgressReport =
        trimmed.includes("サボ") ||
        trimmed.includes("さぼ") ||
        trimmed.toLowerCase().includes("saborou");

      setChatMessages((prev) => [
        ...prev,
        { id: userId, role: "user", text: trimmed },
        {
          id: saborouId,
          role: "saborou",
          text: reply,
          action: shouldOfferProgressReport ? "progress_report" : undefined,
        },
      ]);
    },
    [representativeProposal, freeTimeSession],
  );

  const postSaborouMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const saborouId = `s${chatSeqRef.current++}`;
    setChatMessages((prev) => [
      ...prev,
      { id: saborouId, role: "saborou", text: trimmed },
    ]);
  }, []);

  const offerVideoContinuation = useCallback(() => {
    const saborouId = `s${chatSeqRef.current++}`;
    setChatMessages((prev) => [
      ...prev,
      {
        id: saborouId,
        role: "saborou",
        text: "定期的な進捗報告は問題ないね！あとは、余白を味わうだけ。そういえば、この前見てた進撃の巨人の続き、30分だけ観ちゃう？",
        action: "watch_video",
      },
    ]);
  }, []);

  const value = useMemo<SaborouContextValue>(
    () => ({
      userInfo,
      jwt,
      candidates,
      candidatesLoading,
      candidatesError,
      refreshCandidates,
      removeCandidate,
      tasks,
      tasksLoading,
      tasksError,
      refreshTasks,
      representativeProposal,
      scheduleSaboruMinutes,
      freeTimeSession,
      latestSlackMessage,
      sendSlackViaDom,
      notifyReplyCompleted,
      chatMessages,
      postChatMessage,
      postSaborouMessage,
      offerVideoContinuation,
      goalAnalysis,
      setGoalAnalysis,
      delegatedTaskId,
      setDelegatedTaskId,
      registerDelegatedTask,
    }),
    [
      userInfo,
      jwt,
      candidates,
      candidatesLoading,
      candidatesError,
      refreshCandidates,
      removeCandidate,
      tasks,
      tasksLoading,
      tasksError,
      refreshTasks,
      representativeProposal,
      scheduleSaboruMinutes,
      freeTimeSession,
      latestSlackMessage,
      sendSlackViaDom,
      notifyReplyCompleted,
      chatMessages,
      postChatMessage,
      postSaborouMessage,
      offerVideoContinuation,
      goalAnalysis,
      delegatedTaskId,
      registerDelegatedTask,
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
