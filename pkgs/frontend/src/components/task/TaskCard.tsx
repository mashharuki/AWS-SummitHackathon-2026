import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateJa, isOverdue } from "@/lib/utils";
import type { Task, TaskCandidate } from "@saboru/shared";
/**
 * タスクカード — pending / approved 両対応
 * モックUI saborou_v2_02-tasklist.png 参照
 */
import { Check, ChevronRight, Clock, X } from "lucide-react";
import { Link } from "react-router-dom";

// --- 保留中 (候補) カード ---
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
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {candidate.sourceType === "slack" ? "Slack" : "手動"}
              </Badge>
              {overdue && (
                <Badge variant="must" className="text-xs">
                  <Clock size={10} className="mr-1" />
                  期限切れ
                </Badge>
              )}
            </div>
            <p className="font-medium text-[#1A1A1A] text-sm truncate">
              {candidate.title}
            </p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              期限: {formatDateJa(candidate.deadline)}
              {candidate.requester && ` · ${candidate.requester}`}
            </p>
          </div>

          {/* アクションボタン */}
          <div className="flex gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onReject(candidate.candidateId)}
              aria-label={`${candidate.title} を却下`}
              className="h-8 w-8 text-[#F44336] hover:bg-red-50"
            >
              <X size={16} />
            </Button>
            <Button
              size="icon"
              onClick={() => onApprove(candidate.candidateId)}
              aria-label={`${candidate.title} を承認`}
              className="h-8 w-8"
            >
              <Check size={16} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- 承認済み カード ---
interface TaskCardProps {
  task: Task;
  verdict?: "can_saboru" | "borderline" | "must_do" | null;
  summaryText?: string;
}

const VERDICT_STYLES = {
  can_saboru: {
    badge: "can" as const,
    label: "サボれます",
  },
  borderline: {
    badge: "borderline" as const,
    label: "ボーダーライン",
  },
  must_do: {
    badge: "must" as const,
    label: "やらないとまずい",
  },
};

export function TaskCard({ task, verdict, summaryText }: TaskCardProps) {
  const overdue = isOverdue(task.deadline);
  const verdictStyle = verdict ? VERDICT_STYLES[verdict] : null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <Link
        to={`/tasks/${task.taskId}`}
        className="block"
        aria-label={`${task.title} の詳細を見る`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {verdictStyle && (
                  <Badge variant={verdictStyle.badge} className="text-xs">
                    {verdictStyle.label}
                  </Badge>
                )}
                {overdue && (
                  <Badge variant="must" className="text-xs">
                    <Clock size={10} className="mr-1" />
                    期限切れ
                  </Badge>
                )}
              </div>
              <p className="font-medium text-[#1A1A1A] text-sm">{task.title}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">
                期限: {formatDateJa(task.deadline)}
                {task.requester && ` · ${task.requester}`}
              </p>
              {summaryText && (
                <p className="text-xs text-[#6B7280] mt-1 line-clamp-1">
                  {summaryText}
                </p>
              )}
            </div>
            <ChevronRight
              size={16}
              className="text-[#9CA3AF] shrink-0 mt-0.5"
              aria-hidden="true"
            />
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
