import { SaborouCharacter2D } from "@/components/character/SaborouCharacter2D";
import { SlackShareControl } from "@/components/features/SlackShareControl";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskEditForm } from "@/components/task/TaskEditForm";
import {
  AchievementToast,
  useAchievements,
} from "@/components/ui/AchievementBadge";
import { ComboCounter } from "@/components/ui/ComboCounter";
import { DependencyScoreDisplay } from "@/components/ui/DependencyScoreDisplay";
import { GrowthJourneyBanner } from "@/components/ui/GrowthJourneyBanner";
import { JackpotOverlay } from "@/components/ui/JackpotOverlay";
import {
  ManualProgressCard,
  useManualProgress,
} from "@/components/ui/ManualProgressCard";
import { PositioningCard } from "@/components/ui/PositioningCard";
import {
  SaboriStreakBadge,
  loadStreakState,
  updateStreak,
} from "@/components/ui/SaboriStreakBadge";
import { ShareButton } from "@/components/ui/ShareCard";
import { ContextCollectingAnim } from "@/components/verdict/ContextCollectingAnim";
import { DeferralCountdown } from "@/components/verdict/DeferralCountdown";
import { EvidenceList } from "@/components/verdict/EvidenceList";
import { PsychSignalsCard } from "@/components/verdict/PsychSignalsCard";
import { VerdictBox } from "@/components/verdict/VerdictBox";
import { saveVerdictEntry } from "@/components/verdict/VerdictHistory";
import { useProposalStream } from "@/hooks/useProposalStream";
import { useSaboriGamification } from "@/hooks/useSaboriGamification";
import { useTasks } from "@/hooks/useTasks";
import apiClient from "@/lib/apiClient";
import { getTitleInfo } from "@/lib/gamificationUtils";
import { formatDeadlineDisplay } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types/ui";
/**
 * タスク詳細ページ — U-07-gamification Tier 1〜3 統合版
 *
 * ゲーミフィケーション要素を全面統合:
 * - Tier 1: AI依存度スコア育成ゲーム化、A〜E評価、コンボ、ジャックポット
 * - Tier 2: ストリーク、取扱説明書完成度ゲージ、実績システム
 * - Tier 3: サボりシェアカード、競合対比ポジショニングUI
 */
import type { Proposal, QuickReplyType, Task } from "@saboru/shared";
import { Edit2, Trash2 } from "lucide-react";
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

export function TaskDetailPage() {
  const { i18n, t } = useTranslation();
  const { id: taskId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tasks, updateTask, deleteTask } = useTasks();

  const [task, setTask] = useState<Task | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    const found = tasks.find((t) => t.taskId === taskId);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.evaluatedAt]);

  // 初回ロード時にストリーミング開始
  useEffect(() => {
    if (taskId && !proposal) {
      void startProposal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // proposal が新しく届いたとき: Tier 1〜2 ゲーミフィケーション結果を記録
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proposal.evaluatedAt を依存キーとして使う意図的な設計
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

  return (
    <AppShell>
      {/* === ゲーミフィケーション演出レイヤー === */}

      {/* 称号解除バナー（Tier 1） */}
      <GrowthJourneyBanner
        titleInfo={titleUnlockEvent}
        onClose={clearTitleUnlockEvent}
      />

      {/* A+ ジャックポット全画面演出（Tier 1） */}
      <JackpotOverlay isActive={isJackpot} onClose={clearJackpot} />

      {/* 実績解除トースト通知（Tier 2） */}
      {pendingToast && (
        <AchievementToast achievement={pendingToast} onClose={dismissToast} />
      )}

      {/* === メインコンテンツ === */}
      <div className="flex flex-col h-full">
        <PageHeader
          title={t("tasks.detailTitle")}
          subtitle={`${task.requester ?? ""} ${task.sourceType === "slack" ? "· Slack" : ""}`}
          onBack={() => navigate("/tasks")}
          right={
            <div className="flex items-center gap-2">
              {/* コンボカウンター */}
              <ComboCounter combo={combo} />

              {/* AI依存度スコア（育成ゲーム型） */}
              <DependencyScoreDisplay
                score={dependencyScore}
                justIncremented={justIncremented}
              />

              {!isEditing && (
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
              )}
            </div>
          }
        />

        {/*
          Mobile: 単一カラム + スクロール
          lg+: 2カラム（左: タスク情報/3D/判定、右: チャット）
        */}
        <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
          {/* 左カラム: タスク情報・3Dヒーロー・判定結果 */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-24 md:pb-8 lg:pb-6 flex flex-col gap-3 pt-3 lg:max-w-lg lg:border-r-[3px] lg:border-[#2B1E16]">
            {/* タスク情報 */}
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
                    style={{
                      letterSpacing: "-0.02em",
                      lineHeight: 1.25,
                    }}
                  >
                    {task.title}
                  </h1>
                  <p className="text-saboru-ink-muted mt-1.5 text-xs md:text-sm">
                    📅 {formatDeadlineDisplay(task.deadline)}
                  </p>
                </>
              )}
            </div>

            {/* 3D 判定ヒーロー（憲法2: 320px / 憲法4: brutal-3d-container で外枠） */}
            <div className="brutal-3d-container" style={{ height: 280 }}>
              <Suspense
                fallback={
                  <div className="w-full h-full flex items-center justify-center">
                    <SaborouCharacter2D
                      verdict={verdictForDisplay ?? "can_saboru"}
                      size={160}
                    />
                  </div>
                }
              >
                <SaborouScene3D
                  verdict={verdictForDisplay}
                  isStreaming={isStreaming}
                  size={280}
                />
              </Suspense>
            </div>

            {/* ストリーミング中: ContextCollectingAnim を表示 */}
            {isStreaming && !proposal && (
              <ContextCollectingAnim phase={phase} />
            )}

            {/* VerdictBox */}
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

            {/* 時間軸付き先延ばし可視化 — 競合との決定的差別化要素 */}
            {proposal?.nextCheckAt && verdictForDisplay === "can_saboru" && (
              <DeferralCountdown
                nextCheckAt={proposal.nextCheckAt}
                onRecheck={startProposal}
              />
            )}

            {/* C-2: 判定を Slack に共有（連携済み時のみ表示） */}
            {proposal && taskId && <SlackShareControl taskId={taskId} />}

            {/* PsychSignals（verdict 連動の静的プリセット表示） */}
            {verdictForDisplay && (
              <PsychSignalsCard
                verdict={verdictForDisplay}
                psychSignals={proposal?.psychSignals}
              />
            )}

            {/* reasoning リスト */}
            {proposal?.reasoning && proposal.reasoning.length > 0 && (
              <EvidenceList items={proposal.reasoning} />
            )}

            {/* シェアボタン（Tier 3 施策6）: 判定結果がある場合のみ表示 */}
            {proposal?.verdict && currentGrade && (
              <ShareButton
                verdict={proposal.verdict}
                taskTitle={task.title}
                dependencyScore={dependencyScore}
                grade={currentGrade}
                titleName={getTitleInfo(dependencyScore).title}
              />
            )}

            {/* ストリークバッジ（Tier 2 施策3） */}
            {streakState.days > 0 && (
              <SaboriStreakBadge
                streakDays={streakState.days}
                showLossWarning
              />
            )}

            {/* 取扱説明書完成度（Tier 2 施策4） */}
            <ManualProgressCard progress={manualProgress} />

            {/* 競合対比ポジショニングUI（Tier 3 施策7） */}
            <PositioningCard />

            {/* チャット: モバイル/タブレットのみここに表示（lg+ は右カラムへ） */}
            <div className="lg:hidden" style={{ height: 480 }}>
              <Suspense
                fallback={
                  <div
                    className="card-brutal flex items-center justify-center h-full"
                    style={{ background: "#FFFAF5" }}
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
            </div>
          </div>

          {/* 右カラム: チャット（lg+ のみ） */}
          <div className="hidden lg:flex lg:flex-col lg:flex-1 p-4 lg:p-6">
            <Suspense
              fallback={
                <div
                  className="card-brutal flex items-center justify-center flex-1"
                  style={{ background: "#FFFAF5" }}
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
          </div>
        </div>
      </div>
    </AppShell>
  );
}
