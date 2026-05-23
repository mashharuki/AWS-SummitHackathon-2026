import { SaborouCharacter2D } from "@/components/character/SaborouCharacter2D";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskEditForm } from "@/components/task/TaskEditForm";
import { DependencyScoreDisplay } from "@/components/ui/DependencyScoreDisplay";
import { ContextCollectingAnim } from "@/components/verdict/ContextCollectingAnim";
import { EvidenceList } from "@/components/verdict/EvidenceList";
import { PsychSignalsCard } from "@/components/verdict/PsychSignalsCard";
import { VerdictBox } from "@/components/verdict/VerdictBox";
import { useDependencyScore } from "@/hooks/useDependencyScore";
import { useProposalStream } from "@/hooks/useProposalStream";
import { useTasks } from "@/hooks/useTasks";
import apiClient from "@/lib/apiClient";
import { formatDeadlineDisplay } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types/ui";
/**
 * タスク詳細ページ — U-06-ui-redesign Phase 5 改修版
 *
 * 共有 HTML TaskDetailScreen 準拠（ネオブルータリズム）
 * 構成: PageHeader / タスクヘッダー / 3Dヒーロー（判定の主役）/ VerdictBox /
 *       PsychSignalsCard / EvidenceList / ContextCollectingAnim / ChatPane
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
  const {
    score,
    justDecremented,
    decrement: decrementScore,
  } = useDependencyScore();

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

  // 初回ロード時にストリーミング開始
  useEffect(() => {
    if (taskId && !proposal) {
      void startProposal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

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
    agree_with_ai: 3, // AIに完全同意 → 自己判断力 -3%
    truly_tired: 2, // 疲れているのでサボる → -2%
    disagree_with_ai: 0, // AIに反論 → 自己判断力は保持
    actually_important: 0, // 重要と判断 → 自己判断力は保持
  };

  const handleQuickReply = (type: QuickReplyType, label: string) => {
    void sendQuickReply(label);
    void apiClient
      .submitHonne(taskId ?? "", { type: "quick_reply", content: type })
      .catch(() => {
        // 非致命的
      });
    const delta = QUICK_REPLY_DELTA[type];
    if (delta > 0) void decrementScore(delta);
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
      <div className="flex flex-col h-full">
        <PageHeader
          title={t("tasks.detailTitle")}
          subtitle={`${task.requester ?? ""} ${task.sourceType === "slack" ? "· Slack" : ""}`}
          onBack={() => navigate("/tasks")}
          right={
            <div className="flex items-center gap-2">
              <DependencyScoreDisplay
                score={score}
                justDecremented={justDecremented}
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

            {/* PsychSignals（AI が計算した実シグナル。なければ verdict フォールバック） */}
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
