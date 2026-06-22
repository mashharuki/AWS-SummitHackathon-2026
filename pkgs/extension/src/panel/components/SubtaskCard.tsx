/**
 * SubtaskCard — PM WBS分解のサブタスク承認UI
 *
 * PM機能: 各サブタスクを人間が確認・承認してからSABOROUが代行実行する
 * ハンドオフカードコンポーネント。
 */

import type { SubTask, SubTaskStatus } from "@/panel/lib/types";
import { CheckCircle2, ChevronRight, Loader2, Play, SkipForward, Sparkles } from "lucide-react";

interface SubtaskCardProps {
  subtask: SubTask;
  isActive: boolean;
  onApprove?: () => void;
  onSkip?: () => void;
}

const TYPE_LABELS: Record<SubTask["saborouType"], string> = {
  work: "代行",
  decision: "意思決定",
  saboru: "AI自動",
};

const TYPE_COLORS: Record<SubTask["saborouType"], { bg: string; text: string; border: string }> = {
  work: { bg: "#dbeafe", text: "#1d4ed8", border: "#3b82f6" },
  decision: { bg: "#fef3c7", text: "#92400e", border: "#f59e0b" },
  saboru: { bg: "#d1fae5", text: "#065f46", border: "#10b981" },
};

const STATUS_ICON: Partial<Record<SubTaskStatus, React.ReactNode>> = {
  done: <CheckCircle2 size={16} className="text-[#10b981]" />,
  executing: <Loader2 size={16} className="text-[#3b82f6] animate-spin" />,
  skipped: <SkipForward size={16} className="text-[#9ca3af]" />,
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

export function SubtaskCard({ subtask, isActive, onApprove, onSkip }: SubtaskCardProps) {
  const colors = TYPE_COLORS[subtask.saborouType];
  const isDone = subtask.status === "done" || subtask.status === "skipped";
  const isExecuting = subtask.status === "executing";
  const isPending = subtask.status === "pending";

  return (
    <div
      className="rounded-xl border-2 p-3 transition-all"
      style={{
        borderColor: isActive ? colors.border : isDone ? "#e5e7eb" : "#d1d5db",
        background: isActive ? `${colors.bg}66` : isDone ? "#f9fafb" : "white",
        opacity: !isActive && !isDone ? 0.6 : 1,
        boxShadow: isActive ? `0 2px 0 ${colors.border}` : "none",
      }}
    >
      <div className="flex items-start gap-2">
        {/* Status icon or order number */}
        <div className="mt-0.5 w-5 h-5 flex items-center justify-center flex-shrink-0">
          {STATUS_ICON[subtask.status] ?? (
            <span className="text-xs font-bold text-[#9ca3af]">
              {subtask.order + 1}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title + type badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="font-semibold text-sm"
              style={{ color: isDone ? "#9ca3af" : isActive ? "#111827" : "#4b5563" }}
            >
              {subtask.title}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium border"
              style={{
                background: colors.bg,
                color: colors.text,
                borderColor: colors.border,
              }}
            >
              {subtask.saborouType === "saboru" && <Sparkles size={9} className="inline mr-0.5" />}
              {TYPE_LABELS[subtask.saborouType]}
            </span>
            <span className="text-xs text-[#9ca3af]">{formatMinutes(subtask.estimatedMinutes)}</span>
          </div>

          {/* Description */}
          {subtask.description && (isActive || isExecuting) && (
            <p className="text-xs text-[#6b7280] mt-0.5 leading-relaxed line-clamp-2">
              {subtask.description}
            </p>
          )}

          {/* Action buttons — active pending state only */}
          {isActive && isPending && (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={onApprove}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-bold py-1.5 px-3 rounded-lg border-2 transition-all active:scale-95"
                style={{
                  background: colors.bg,
                  color: colors.text,
                  borderColor: colors.border,
                  boxShadow: `0 2px 0 ${colors.border}`,
                }}
              >
                <Play size={11} />
                {subtask.saborouType === "decision" ? "判断する" : "代行させる"}
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="flex items-center justify-center gap-1 text-xs font-medium py-1.5 px-2 rounded-lg border transition-all active:scale-95 text-[#9ca3af] border-[#e5e7eb] hover:bg-gray-50"
              >
                <ChevronRight size={11} />
                スキップ
              </button>
            </div>
          )}

          {/* Executing state */}
          {isExecuting && (
            <div className="flex items-center gap-1 mt-1.5">
              <Loader2 size={11} className="text-[#3b82f6] animate-spin" />
              <span className="text-xs text-[#3b82f6]">SABOROUが代行中...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
