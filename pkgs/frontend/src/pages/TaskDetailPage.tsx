import { SaborouCharacter2D } from "@/components/character/SaborouCharacter2D";
import { SlackShareControl } from "@/components/features/SlackShareControl";
import { GanttPanel } from "@/components/gantt/GanttPanel";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskEditForm } from "@/components/task/TaskEditForm";
import {
  AchievementToast,
  useAchievements,
} from "@/components/ui/AchievementBadge";
import { ComboCounter } from "@/components/ui/ComboCounter";
import { DependencyScoreDisplay } from "@/components/ui/DependencyScoreDisplay";
import { Drawer } from "@/components/ui/Drawer";
import { GrowthJourneyBanner } from "@/components/ui/GrowthJourneyBanner";
import { GuildMockCard } from "@/components/ui/GuildMockCard";
import { JackpotOverlay } from "@/components/ui/JackpotOverlay";
import {
  ManualProgressCard,
  useManualProgress,
} from "@/components/ui/ManualProgressCard";
import { Popover } from "@/components/ui/Popover";
import { PositioningCard } from "@/components/ui/PositioningCard";
import { PvPMockCard } from "@/components/ui/PvPMockCard";
import {
  SaboriStreakBadge,
  loadStreakState,
  updateStreak,
} from "@/components/ui/SaboriStreakBadge";
import { SeasonBanner } from "@/components/ui/SeasonBanner";
import { ShareButton } from "@/components/ui/ShareCard";
import { WeeklyChallengeCard } from "@/components/ui/WeeklyChallengeCard";
import { ContextCollectingAnim } from "@/components/verdict/ContextCollectingAnim";
import { DeferralCountdown } from "@/components/verdict/DeferralCountdown";
import { EvidenceList } from "@/components/verdict/EvidenceList";
import { PsychSignalsCard } from "@/components/verdict/PsychSignalsCard";
import { VerdictBox } from "@/components/verdict/VerdictBox";
import { saveVerdictEntry } from "@/components/verdict/VerdictHistory";
import { useAuth } from "@/hooks/useAuth";
import { useProposalStream } from "@/hooks/useProposalStream";
import { useSaboriGamification } from "@/hooks/useSaboriGamification";
import { useTasks } from "@/hooks/useTasks";
import apiClient from "@/lib/apiClient";
import { getTitleInfo } from "@/lib/gamificationUtils";
import { formatDeadlineDisplay } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types/ui";
/**
 * タスク詳細ページ — U-G08 3ペイン/4タブ再編版
 *
 * 構成:
 * - PC (lg+): 3ペイン（左: タスク文脈+判定HUD / 中央: ガント盤面 / 右: チャット）
 *   ゲーム要素は HUD 常駐 + Popover / 右ペイン Drawer で「押下して開く」
 * - スマホ (< lg): 4タブ（ガント / 判定 / チャット / ゲーム）で縦圧縮
 *
 * 既存のゲーミフィケーション資産は全て維持し、配置のみ再編する。
 */
import type { Proposal, QuickReplyType, Task } from "@saboru/shared";
import { Edit2, Gamepad2, Trash2 } from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

// 3D ヒーロー（憲法: lazy で別チャンク）
const SaborouScene3D = lazy(() =>
  import("@/components/three/SaborouScene3D").then((m) => ({
    default: m.SaborouScene3D,
  })),
);

// ChatPane（独立 chunk）
const ChatPane = lazy(() =>
  import("@/components/chat/ChatPane").then((m) => ({ default: m.ChatPane })),
);

type MobileTab = "gantt" | "verdict" | "chat" | "game";

export function TaskDetailPage() {
  const { i18n, t } = useTranslation();
  const { id: taskId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tasks, updateTask, deleteTask } = useTasks();

  const [task, setTask] = useState<Task | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // スマホタブ / ゲームドロワー
  const [mobileTab, setMobileTab] = useState<MobileTab>("gantt");
  const [gameDrawerOpen, setGameDrawerOpen] = useState(false);

  // ゲーミフィケーション統合フック（Tier 1）
  const {
    dependencyScore,
    justIncremented,
    combo,
    currentGrade,
    titleUnlockEvent,
    isJackpot,
    recordSaboriResult,
    clearTitleUnlockEvent,
    clearJackpot,
  } = useSaboriGamification();

  // Tier 2: 取扱説明書完成度
  const { progress: manualProgress, onHonneSubmit: onManualHonneSubmit } =
    useManualProgress();

  // Tier 2: 実績システム
  const { pendingToast, dismissToast, checkAndUnlock } = useAchievements();

  // ストリーク状態（localStorage から読み込み、更新はサボり実行時）
  const [streakState, setStreakState] = useState(() => loadStreakState());

  // タスク取得
  useEffect(() => {
    if (!taskId) return;
    const found = tasks.find((tk) => tk.taskId === taskId);
    if (found) {
      setTask(found);
    } else {
      apiClient
        .getTask(taskId)
        .then(setTask)
        .catch(() => {
          void navigate("/tasks", { replace: true });
        });
    }
  }, [taskId, tasks, navigate]);

  // 最新提案取得
  useEffect(() => {
    if (!taskId) return;
    apiClient
      .getProposal(taskId)
      .then(setProposal)
      .catch(() => {
        // 提案がない場合は無視
      });
  }, [taskId]);

  // SSE ストリーミング
  const {
    messages: streamMessages,
    isStreaming,
    currentVerdict,
    startProposal,
    sendQuickReply,
    sendFreeText,
  } = useProposalStream({
    taskId: taskId ?? "",
    onProposalReady: (p) => setProposal(p),
  });

  // 判定履歴をlocalStorageに保存（task + proposal 両方が揃ったとき）
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional trigger on proposal update
  useEffect(() => {
    if (task && proposal) {
      saveVerdictEntry({
        taskId: proposal.taskId,
        taskTitle: task.title,
        verdict: proposal.verdict,
        summaryText: proposal.summaryText,
        evaluatedAt: proposal.evaluatedAt,
      });
    }
  }, [proposal?.evaluatedAt]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional run-once on taskId
  useEffect(() => {
    if (taskId && !proposal) {
      void startProposal();
    }
  }, [taskId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional trigger on proposal update
  useEffect(() => {
    if (proposal?.verdict) {
      const signals = proposal.psychSignals;
      const signalCount = signals
        ? Object.values(signals).filter((v) => v === "high").length
        : undefined;

      void recordSaboriResult({ verdict: proposal.verdict, signalCount });

      // Tier 2: ストリーク更新（サボれ判定時のみ）
      if (proposal.verdict === "can_saboru") {
        const nextStreak = updateStreak(streakState);
        setStreakState(nextStreak);

        // Tier 2: 実績チェック
        checkAndUnlock({
          verdict: proposal.verdict,
          dependencyScore,
          comboCount: combo.count,
          streakDays: nextStreak.days,
          manualProgress,
          isJackpot,
          nowHour: new Date().getHours(),
        });
      }
    }
  }, [proposal?.evaluatedAt]);

  // チャットメッセージを型変換
  const chatMessages: ChatMessageType[] = streamMessages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    timestamp: new Date().toISOString(),
  }));

  // SSE 進行から phase を推定（GAP-04 対応の簡易ロジック）
  const phase: 0 | 1 | 2 = !currentVerdict
    ? 0
    : streamMessages.some((m) => m.role === "assistant")
      ? 2
      : 1;

  const handleDelete = async () => {
    if (!taskId || !window.confirm(t("tasks.deleteConfirm"))) return;
    setIsDeleting(true);
    try {
      await deleteTask(taskId);
      void navigate("/tasks", { replace: true });
    } finally {
      setIsDeleting(false);
    }
  };

  const QUICK_REPLY_DELTA: Record<QuickReplyType, number> = {
    agree_with_ai: 8, // AIに完全同意 → AI依存度 +8%
    truly_tired: 5, // 疲れているのでサボる → +5%
    disagree_with_ai: 0,
    actually_important: 0,
  };

  const handleQuickReply = (type: QuickReplyType, label: string) => {
    void sendQuickReply(label);
    void apiClient
      .submitHonne(taskId ?? "", { type: "quick_reply", content: type })
      .catch(() => {
        // 非致命的
      });

    // ゲーミフィケーション: agree_with_ai / truly_tired のときスコア更新
    const delta = QUICK_REPLY_DELTA[type];
    if (delta > 0 && proposal?.verdict) {
      void recordSaboriResult({
        verdict: proposal.verdict,
        signalCount: proposal.psychSignals
          ? Object.values(proposal.psychSignals).filter((v) => v === "high")
              .length
          : undefined,
      });

      // Tier 2: 取扱説明書完成度 +3%
      onManualHonneSubmit();

      // Tier 2: 実績チェック
      const newProgress = Math.min(100, manualProgress + 3);
      checkAndUnlock({
        verdict: proposal.verdict,
        dependencyScore,
        comboCount: combo.count,
        streakDays: streakState.days,
        manualProgress: newProgress,
        isJackpot,
        nowHour: new Date().getHours(),
      });
    }
  };

  if (!task) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div
            className="w-8 h-8 border-2 border-saboru-orange border-t-transparent rounded-full animate-spin"
            role="status"
            aria-label={t("common.loading")}
          />
        </div>
      </AppShell>
    );
  }

  const verdictForDisplay = proposal?.verdict ?? currentVerdict ?? null;
  const reasoningCount = proposal?.reasoning?.length ?? 0;

  // ─────────────────────────────────────────────
  // 部分ビュー（PC/スマホで共有）
  // ─────────────────────────────────────────────

  const taskInfoBlock = (
    <div className="card-brutal p-3.5">
      {isEditing ? (
        <TaskEditForm
          task={task}
          onSave={async (data) => {
            const updated = await updateTask(task.taskId, data);
            setTask(updated);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <>
          <h1
            className="text-saboru-ink font-extrabold text-lg md:text-xl"
            style={{ letterSpacing: "-0.02em", lineHeight: 1.25 }}
          >
            {task.title}
          </h1>
          <p className="text-saboru-ink-muted mt-1.5 text-xs md:text-sm">
            📅 {formatDeadlineDisplay(task.deadline)}
          </p>
        </>
      )}
    </div>
  );

  const verdictBlock = (
    <>
      {/* 3D 判定ヒーロー */}
      <div className="brutal-3d-container shrink-0" style={{ height: 240 }}>
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center">
              <SaborouCharacter2D
                verdict={verdictForDisplay ?? "can_saboru"}
                size={140}
                personaId={user?.preferredPersonaId}
              />
            </div>
          }
        >
          <SaborouScene3D
            verdict={verdictForDisplay}
            isStreaming={isStreaming}
            size={240}
            personaId={user?.preferredPersonaId}
          />
        </Suspense>
      </div>

      {isStreaming && !proposal && <ContextCollectingAnim phase={phase} />}

      {verdictForDisplay && proposal && (
        <VerdictBox
          verdict={verdictForDisplay}
          summaryText={proposal.summaryText}
          evaluatedAt={
            proposal.evaluatedAt
              ? new Date(proposal.evaluatedAt).toLocaleString(
                  i18n.language.startsWith("ja") ? "ja-JP" : "en-US",
                  {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )
              : undefined
          }
        />
      )}

      {proposal?.nextCheckAt && verdictForDisplay === "can_saboru" && (
        <DeferralCountdown
          nextCheckAt={proposal.nextCheckAt}
          onRecheck={startProposal}
        />
      )}

      {/* 補足情報は Popover で「押下して開く」 */}
      <div className="flex flex-wrap gap-2">
        {verdictForDisplay && (
          <Popover
            trigger={
              <span className="btn-brutal-secondary text-xs">
                🧠 心理シグナル
              </span>
            }
          >
            <PsychSignalsCard
              verdict={verdictForDisplay}
              psychSignals={proposal?.psychSignals}
            />
          </Popover>
        )}
        {proposal?.reasoning && proposal.reasoning.length > 0 && (
          <Popover
            trigger={
              <span className="btn-brutal-secondary text-xs">
                📋 根拠を見る
              </span>
            }
          >
            <EvidenceList items={proposal.reasoning} />
          </Popover>
        )}
        <Popover
          trigger={
            <span className="btn-brutal-secondary text-xs">📊 立ち位置</span>
          }
        >
          <PositioningCard />
        </Popover>
      </div>

      {/* C-2: 判定を Slack に共有 */}
      {proposal && taskId && <SlackShareControl taskId={taskId} />}

      {/* シェアボタン */}
      {proposal?.verdict && currentGrade && (
        <ShareButton
          verdict={proposal.verdict}
          taskTitle={task.title}
          dependencyScore={dependencyScore}
          grade={currentGrade}
          titleName={getTitleInfo(dependencyScore).title}
        />
      )}
    </>
  );

  const chatBlock = (
    <Suspense
      fallback={
        <div
          className="card-brutal flex items-center justify-center flex-1"
          style={{ background: "#FFFAF5", minHeight: 200 }}
        >
          <div
            className="w-6 h-6 border-2 border-saboru-orange border-t-transparent rounded-full animate-spin"
            role="status"
            aria-label={t("common.loading")}
          />
        </div>
      }
    >
      <ChatPane
        messages={chatMessages}
        isStreaming={isStreaming}
        onQuickReply={handleQuickReply}
        onFreeText={(text) => void sendFreeText(text)}
        showQuickReplies={chatMessages.length > 0}
      />
    </Suspense>
  );

  // ゲーム要素まとめ（ドロワー / ゲームタブ で開く）
  const gameContent = (
    <div className="flex flex-col gap-3">
      {streakState.days > 0 && (
        <SaboriStreakBadge streakDays={streakState.days} showLossWarning />
      )}
      <ManualProgressCard progress={manualProgress} />
      <WeeklyChallengeCard />
      <SeasonBanner />
      <GuildMockCard />
      <PvPMockCard />
    </div>
  );

  // 画面上部に常駐する HUD（スコア・コンボ・ストリーク・ゲームを開くボタン）
  const hud = (
    <div className="flex items-center gap-2">
      <ComboCounter combo={combo} />
      <DependencyScoreDisplay
        score={dependencyScore}
        justIncremented={justIncremented}
      />
      <button
        type="button"
        onClick={() => setGameDrawerOpen(true)}
        aria-label="ゲーム要素を開く"
        className="p-1.5 text-saboru-orange hover:text-saboru-orange-dark"
      >
        <Gamepad2 size={18} aria-hidden="true" />
      </button>
    </div>
  );

  const editDeleteButtons = !isEditing && (
    <>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label={t("tasks.editTask")}
        className="p-1.5 text-saboru-ink-soft hover:text-saboru-ink"
      >
        <Edit2 size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={isDeleting}
        aria-label={t("tasks.deleteTask")}
        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </>
  );

  return (
    <AppShell>
      {/* === ゲーミフィケーション演出レイヤー === */}
      <GrowthJourneyBanner
        titleInfo={titleUnlockEvent}
        onClose={clearTitleUnlockEvent}
      />
      <JackpotOverlay isActive={isJackpot} onClose={clearJackpot} />
      {pendingToast && (
        <AchievementToast achievement={pendingToast} onClose={dismissToast} />
      )}

      {/* ゲーム要素ドロワー（HUDのゲームアイコンから開く / 全要素を保持） */}
      <Drawer
        open={gameDrawerOpen}
        onClose={() => setGameDrawerOpen(false)}
        title="🎮 サボりゲーム"
      >
        {gameContent}
      </Drawer>

      <div className="flex flex-col flex-1 min-h-0">
        <PageHeader
          title={t("tasks.detailTitle")}
          subtitle={`${task.requester ?? ""} ${task.sourceType === "slack" ? "· Slack" : ""}`}
          onBack={() => navigate("/tasks")}
          right={
            <div className="flex items-center gap-2">
              {hud}
              {editDeleteButtons}
            </div>
          }
        />

        {/* ───────── PC: 3ペイン ───────── */}
        <div className="hidden lg:flex flex-1 min-h-0 overflow-hidden">
          {/* 左: タスク文脈 + 判定 */}
          <div className="w-[360px] shrink-0 overflow-y-auto px-4 py-3 flex flex-col gap-3 border-r-[3px] border-saboru-heavy">
            {taskInfoBlock}
            {verdictBlock}
          </div>
          {/* 中央: ガント盤面（主役） */}
          <div className="flex-1 min-w-0 overflow-y-auto px-4 py-3">
            {taskId && (
              <GanttPanel taskId={taskId} reasoningCount={reasoningCount} />
            )}
          </div>
          {/* 右: チャット */}
          <div className="w-[360px] shrink-0 flex flex-col p-4 border-l-[3px] border-saboru-heavy">
            {chatBlock}
          </div>
        </div>

        {/* ───────── スマホ: 4タブ ───────── */}
        <div className="lg:hidden flex flex-col flex-1 min-h-0">
          <MobileTabBar tab={mobileTab} onChange={setMobileTab} />
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-24 pt-3 flex flex-col gap-3">
            {mobileTab === "gantt" && taskId && (
              <GanttPanel taskId={taskId} reasoningCount={reasoningCount} />
            )}
            {mobileTab === "verdict" && (
              <>
                {taskInfoBlock}
                {verdictBlock}
              </>
            )}
            {mobileTab === "chat" && (
              <div className="flex flex-col" style={{ minHeight: 480 }}>
                {chatBlock}
              </div>
            )}
            {mobileTab === "game" && gameContent}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────
// スマホ用タブバー
// ─────────────────────────────────────────────

const MOBILE_TABS: { id: MobileTab; label: string }[] = [
  { id: "gantt", label: "📊 ガント" },
  { id: "verdict", label: "🦥 判定" },
  { id: "chat", label: "💬 チャット" },
  { id: "game", label: "🎮 ゲーム" },
];

function MobileTabBar({
  tab,
  onChange,
}: {
  tab: MobileTab;
  onChange: (t: MobileTab) => void;
}) {
  return (
    <div
      className="flex border-b-[3px] border-saboru-heavy bg-saboru-paper"
      role="tablist"
    >
      {MOBILE_TABS.map((item) => {
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className="flex-1 py-2 text-xs font-bold transition-colors"
            style={{
              color: active ? "#F97316" : "#9CA3AF",
              borderBottom: active
                ? "3px solid #F97316"
                : "3px solid transparent",
              marginBottom: -3,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
