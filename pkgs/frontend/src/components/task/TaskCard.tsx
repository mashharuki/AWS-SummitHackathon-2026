import { SaborouCharacter2D } from "@/components/character/SaborouCharacter2D";
import { formatDateJa, isOverdue } from "@/lib/utils";
import { VERDICT_META } from "@/lib/verdictMeta";
/**
 * タスクカード — pending（CandidateCard）/ approved（TaskCard）両対応
 *
 * U-06-ui-redesign Phase 5 改修版
 * 共有 HTML TaskCard / PendingCard 準拠（ネオブルータリズム + 2D アバター）
 */
import type { Task, TaskCandidate, Verdict } from "@saboru/shared";
import { Clock, X } from "lucide-react";
import { Link } from "react-router-dom";

/* ─── PendingCard（候補タスク）─────────────────────── */
interface CandidateCardProps {
  candidate: TaskCandidate;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function CandidateCard({
  candidate,
  onApprove,
  onReject,
}: CandidateCardProps) {
  const overdue = isOverdue(candidate.deadline);

  return (
    <div
      style={{
        background: "#FFFDF8",
        border: "3px dashed #2B1E16",
        borderRadius: 20,
        padding: "12px 14px",
        boxShadow: "0 4px 0 #2B1E16",
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="font-bold tracking-wider"
          style={{
            fontSize: 9,
            background: "#FED7AA",
            color: "#EA580C",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          AI抽出
        </span>
        <span className="text-saboru-ink-muted" style={{ fontSize: 10 }}>
          {candidate.sourceType === "slack" ? "Slack" : "手動"}
        </span>
        {overdue && (
          <span
            className="font-bold"
            style={{
              fontSize: 9,
              background: "#FEF2F2",
              color: "#EF4444",
              padding: "1px 5px",
              borderRadius: 4,
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Clock size={9} aria-hidden="true" />
            期限切れ
          </span>
        )}
      </div>
      <p
        className="text-saboru-ink font-bold"
        style={{ fontSize: 14, lineHeight: 1.3 }}
      >
        {candidate.title}
      </p>
      <p className="text-saboru-ink-muted mt-0.5" style={{ fontSize: 10 }}>
        {candidate.requester && `${candidate.requester} · `}
        期限 {formatDateJa(candidate.deadline)}
      </p>
      <div className="flex gap-1.5 mt-2.5">
        <button
          type="button"
          onClick={() => onApprove(candidate.candidateId)}
          className="btn-brutal-primary flex-1"
          style={{ fontSize: 12, padding: "9px 12px" }}
          aria-label={`${candidate.title} を承認`}
        >
          承認する
        </button>
        <button
          type="button"
          onClick={() => onReject(candidate.candidateId)}
          aria-label={`${candidate.title} を却下`}
          className="text-saboru-ink-muted p-2.5 rounded-xl hover:bg-saboru-line transition-colors"
          style={{
            background: "#FFFFFF",
            border: "1px solid #F3F4F6",
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ─── TaskCard（承認済みタスク）────────────────────── */
interface TaskCardProps {
  task: Task;
  verdict?: Verdict | null;
  summaryText?: string;
}

export function TaskCard({ task, verdict, summaryText }: TaskCardProps) {
  const overdue = isOverdue(task.deadline);
  const meta = verdict ? VERDICT_META[verdict] : null;

  return (
    <Link
      to={`/tasks/${task.taskId}`}
      aria-label={`${task.title} の詳細を見る`}
      className="block card-brutal hover:translate-y-[-1px] hover:shadow-hard-lg transition-transform"
      style={{ padding: "12px 14px", textDecoration: "none" }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p
            className="text-saboru-ink font-bold"
            style={{ fontSize: 14, lineHeight: 1.3 }}
          >
            {task.title}
          </p>
          <p className="text-saboru-ink-muted mt-1" style={{ fontSize: 10 }}>
            {task.requester && `${task.requester} · `}
            締切 {formatDateJa(task.deadline)}
          </p>
        </div>
        {/* verdict 連動の 2D アバター（憲法2: 36px は 2D） */}
        {verdict && (
          <SaborouCharacter2D verdict={verdict} size={36} animated={false} />
        )}
      </div>

      {/* verdict ピル + summaryText */}
      {meta && (
        <div
          className="mt-2 flex items-start gap-2 p-2"
          style={{
            background: meta.bg,
            borderRadius: 12,
            border: "2px solid #2B1E16",
          }}
        >
          <span
            className="font-extrabold tracking-wide flex-shrink-0"
            style={{
              fontSize: 10,
              background: meta.color,
              color: "#FFFFFF",
              padding: "3px 10px",
              borderRadius: 9999,
              border: "2px solid #2B1E16",
              boxShadow: "0 2px 0 #2B1E16",
            }}
          >
            {meta.label}
          </span>
          <span
            className="text-saboru-ink flex-1"
            style={{ fontSize: 11, lineHeight: 1.5 }}
          >
            {summaryText ?? meta.label}
          </span>
        </div>
      )}

      {overdue && !meta && (
        <p
          className="mt-1 flex items-center gap-1"
          style={{ fontSize: 10, color: "#EF4444" }}
        >
          <Clock size={11} aria-hidden="true" /> 期限切れ
        </p>
      )}
    </Link>
  );
}
