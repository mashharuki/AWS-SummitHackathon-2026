/**
 * タスク一覧ページ
 * モックUI saborou_v2_02-tasklist.png に忠実に実装
 */
import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CandidateCard, TaskCard } from "@/components/task/TaskCard";
import { TaskAddModal } from "@/components/task/TaskAddModal";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";

export function TaskListPage() {
  const { user } = useAuth();
  const {
    tasks,
    candidates,
    isLoading,
    refresh,
    approveCandidate,
    rejectCandidate,
    createTask,
  } = useTasks();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const activeTasks = tasks.filter((t) => t.status === "approved");

  return (
    <AppShell>
      <div className="max-w-md mx-auto px-4 py-4 pb-24">
        {/* 今日のバナー */}
        {user && (
          <div className="bg-[#FF6B2B] text-white rounded-2xl px-4 py-3 mb-4 text-sm font-medium">
            今日はサボれます！AIが安全を確認しただれます
          </div>
        )}

        {/* 候補タスクセクション */}
        {candidates.length > 0 && (
          <section aria-labelledby="candidates-heading" className="mb-6">
            <h2
              id="candidates-heading"
              className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-3"
            >
              確認待ちタスク
            </h2>
            <div className="space-y-2">
              {candidates.map((c) => (
                <CandidateCard
                  key={c.candidateId}
                  candidate={c}
                  onApprove={(id) => void approveCandidate(id)}
                  onReject={(id) => void rejectCandidate(id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 承認済みタスクセクション */}
        <section aria-labelledby="tasks-heading">
          <div className="flex items-center justify-between mb-3">
            <h2
              id="tasks-heading"
              className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider"
            >
              承認済みタスク
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void refresh()}
              className="h-7 w-7"
              aria-label="タスクを更新"
              disabled={isLoading}
            >
              <RefreshCw
                size={14}
                className={isLoading ? "animate-spin" : ""}
              />
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-2xl bg-white/60 animate-pulse"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : activeTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#9CA3AF] text-sm">タスクがありません</p>
              <p className="text-[#9CA3AF] text-xs mt-1">
                今日はサボり放題です！
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeTasks.map((task) => (
                <TaskCard key={task.taskId} task={task} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* FAB: タスク追加 */}
      <Button
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg text-white"
        aria-label="タスクを追加"
      >
        <Plus size={24} />
      </Button>

      {/* タスク追加モーダル */}
      <TaskAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={async (data) => {
          await createTask(data);
        }}
      />
    </AppShell>
  );
}
