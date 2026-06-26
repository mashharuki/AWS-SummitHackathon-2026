import type { FreeTimeSession } from "@/panel/SaborouContext";
import { Clock } from "lucide-react";

function getStartLabel(task: FreeTimeSession["nextTask"]): string | null {
  if (!task?.deadline) return null;
  const date = new Date(task.deadline);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildInitialMessage({
  taskTitle,
  nextTaskTitle,
  freeMinutes,
  suggestion,
}: {
  taskTitle: string;
  nextTaskTitle: string | null;
  freeMinutes: number | null;
  suggestion: string;
}) {
  const freeText =
    freeMinutes !== null
      ? `余白は${freeMinutes}分。`
      : "余白時間はまだ確定していないけど、";
  const nextText = nextTaskTitle
    ? `次は${nextTaskTitle}。`
    : "次の予定は未検出。";
  return `よく頑張ったよ。${taskTitle}、ここまで進めたね。${freeText}${nextText}${suggestion}`;
}

function NextTaskStatusCard({
  taskTitle,
  startLabel,
  freeMinutes,
  loading,
}: {
  taskTitle: string;
  startLabel: string;
  freeMinutes: number | null;
  loading: boolean;
}) {
  return (
    <output className="block" data-testid="next-task-status" aria-live="polite">
      <div className="relative overflow-hidden rounded-2xl border-2 border-saboru-heavy bg-white shadow-hard-sm">
        <div className="absolute inset-y-0 right-0 w-24 bg-saboru-orange/15" />
        <div className="relative p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black tracking-[0.12em] text-saboru-ink-muted">
              NEXT TASK
            </p>
            <div className="flex items-center gap-1 rounded-full bg-saboru-orange px-2 py-1 text-[10px] font-black text-white shadow-[0_2px_0_#2b1e16]">
              <Clock size={11} />
              {startLabel}から
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-saboru-ink">
                {taskTitle}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-black text-saboru-ink-muted">
                残り
              </p>
              <p className="leading-none text-3xl font-black text-saboru-orange">
                {loading ? "..." : (freeMinutes ?? "--")}
                <span className="ml-0.5 text-sm text-saboru-ink">
                  {freeMinutes === null && !loading ? "" : "分"}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </output>
  );
}

export function FreeTimeSessionPanel({
  session,
}: {
  session: FreeTimeSession;
}) {
  if (!session.task && !session.loading) return null;

  const nextTaskStartLabel = getStartLabel(session.nextTask);
  const statusTaskTitle = session.nextTask?.title ?? "次の予定は未検出";
  const statusStartLabel = nextTaskStartLabel ?? "未確定";
  const initialMessage = buildInitialMessage({
    taskTitle: session.task?.title ?? "いまのタスク",
    nextTaskTitle: session.nextTask?.title ?? null,
    freeMinutes: session.freeMinutes,
    suggestion: session.suggestion,
  });

  return (
    <div className="flex flex-col gap-3" data-testid="free-time-session-panel">
      <NextTaskStatusCard
        taskTitle={statusTaskTitle}
        startLabel={statusStartLabel}
        freeMinutes={session.freeMinutes}
        loading={session.loading}
      />

      <div className="flex gap-2" data-testid="free-time-session-message">
        <div className="shrink-0 w-7 h-7 rounded-lg bg-saboru-orange border-2 border-saboru-heavy shadow-[0_2px_0_#2b1e16] flex items-center justify-center text-white font-black text-[10px]">
          サ
        </div>
        <div className="flex-1 p-2.5 rounded-xl rounded-tl-sm bg-white border-2 border-saboru-heavy shadow-[0_3px_0_#2b1e16]">
          <p className="text-xs text-saboru-ink leading-relaxed">
            {session.loading
              ? "いまのタスクから余白を確認しているよ。少しだけ待ってね。"
              : initialMessage}
          </p>
          {session.error && (
            <p className="mt-1 text-[11px] font-bold text-saboru-ink-muted">
              {session.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
