/**
 * タスク詳細ページ
 * モックUI saborou_v2_03-detail.png に忠実に実装
 * 左: タスク情報 + 判定ボックス / 右: サボローチャット
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Task, Proposal, QuickReplyType } from "@saboru/shared";
import type { ChatMessage } from "@/types/ui";
import { AppShell } from "@/components/layout/AppShell";
import { TaskEditForm } from "@/components/task/TaskEditForm";
import { EvidenceList } from "@/components/verdict/EvidenceList";
import { VerdictBox } from "@/components/verdict/VerdictBox";
import { Button } from "@/components/ui/button";
import { useProposalStream } from "@/hooks/useProposalStream";
import { useTasks } from "@/hooks/useTasks";
import { formatDeadlineDisplay } from "@/lib/utils";
import apiClient from "@/lib/apiClient";

// Three.js を遅延ロード（独立chunk）
const SaborouCanvas = lazy(() =>
  import("@/components/three/SaborouCanvas").then((m) => ({
    default: m.SaborouCanvas,
  })),
);

// ChatPane を遅延ロード
const ChatPane = lazy(() =>
  import("@/components/chat/ChatPane").then((m) => ({ default: m.ChatPane })),
);

export function TaskDetailPage() {
  const { id: taskId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tasks, updateTask, deleteTask } = useTasks();

  const [task, setTask] = useState<Task | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // ストリーミング
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
  const chatMessages: ChatMessage[] = streamMessages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    timestamp: new Date().toISOString(),
  }));

  const handleDelete = async () => {
    if (!taskId || !window.confirm("このタスクを削除しますか？")) return;
    setIsDeleting(true);
    try {
      await deleteTask(taskId);
      void navigate("/tasks", { replace: true });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuickReply = (type: QuickReplyType, label: string) => {
    void sendQuickReply(label);
    void apiClient
      .submitHonne(taskId ?? "", {
        type: "quick_reply",
        content: type,
      })
      .catch(() => {
        // honne記録失敗は非致命的
      });
  };

  if (!task) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div
            className="w-8 h-8 border-2 border-[#FF6B2B] border-t-transparent rounded-full animate-spin"
            role="status"
            aria-label="読み込み中"
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* 戻るボタン */}
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#1A1A1A] mb-4 transition-colors"
          aria-label="タスク一覧に戻る"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          タスク詳細
        </Link>

        {/* 2カラムレイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 左ペイン: タスク情報 */}
          <div className="space-y-4">
            {/* タスクヘッダー */}
            <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB]">
              <div className="flex items-start justify-between gap-2 mb-3">
                {isEditing ? (
                  <div className="flex-1">
                    <TaskEditForm
                      task={task}
                      onSave={async (data) => {
                        const updated = await updateTask(task.taskId, data);
                        setTask(updated);
                        setIsEditing(false);
                      }}
                      onCancel={() => setIsEditing(false)}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <h1 className="font-bold text-[#1A1A1A] text-base leading-tight">
                        {task.title}
                      </h1>
                      <p className="text-xs text-[#6B7280] mt-1">
                        担当: {task.requester} ・ 期限:{" "}
                        {formatDeadlineDisplay(task.deadline)}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsEditing(true)}
                        className="h-8 w-8"
                        aria-label="タスクを編集"
                      >
                        <Edit2 size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDelete()}
                        className="h-8 w-8 text-[#F44336] hover:bg-red-50"
                        aria-label="タスクを削除"
                        disabled={isDeleting}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 判定ボックス */}
            {(proposal ?? currentVerdict) && (
              <div className="space-y-3">
                <VerdictBox
                  verdict={proposal?.verdict ?? currentVerdict ?? "borderline"}
                  summaryText={proposal?.summaryText ?? "AIが評価中です..."}
                  todayMessage="今日は安全にサボれます、報告もばっちりだよだれます！"
                />
                {proposal?.reasoning && proposal.reasoning.length > 0 && (
                  <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB]">
                    <EvidenceList items={proposal.reasoning} />
                  </div>
                )}
              </div>
            )}

            {/* Three.js キャラクター（SM以下では非表示） */}
            <div className="hidden lg:block">
              <Suspense fallback={null}>
                <SaborouCanvas
                  verdict={proposal?.verdict ?? currentVerdict ?? null}
                  isStreaming={isStreaming}
                  className="h-48 w-full"
                />
              </Suspense>
            </div>
          </div>

          {/* 右ペイン: チャット */}
          <div className="h-[600px]">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full bg-[#F5F4F0] rounded-2xl border border-[#E5E7EB]">
                  <div
                    className="w-6 h-6 border-2 border-[#FF6B2B] border-t-transparent rounded-full animate-spin"
                    role="status"
                    aria-label="読み込み中"
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
