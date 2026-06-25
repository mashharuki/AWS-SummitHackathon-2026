/**
 * InboxTab — ②受け機嫌（依頼整理）
 *
 * タスク候補カード一覧（candidates API + content 検知のマージ）。
 * 各カードに「承認」「お断り」。
 *   承認 → ApprovalModal（Bias for Action → 返信文案 → DOM 送信）
 *   お断り → DeclineModal（断り文面 → DOM 送信）
 *
 * モック(11.33.36)準拠。
 */

import { useSaborou } from "@/panel/SaborouContext";
import { ApprovalModal } from "@/panel/components/ApprovalModal";
import { DeclineModal } from "@/panel/components/DeclineModal";
import { Badge, Button, Card, EmptyState } from "@/panel/components/ui";
import type { TaskCandidate } from "@/panel/lib/types";
import { Inbox, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

type ModalState =
  | { kind: "none" }
  | { kind: "approve"; candidate: TaskCandidate }
  | { kind: "decline"; candidate: TaskCandidate };

export function InboxTab({
  onDelegationStart,
}: {
  onDelegationStart?: () => void;
}) {
  const {
    candidates,
    candidatesLoading,
    refreshCandidates,
    removeCandidate,
    refreshTasks,
  } = useSaborou();
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const closeModal = () => setModal({ kind: "none" });

  return (
    <div className="flex flex-col gap-3 px-3 py-3" data-testid="inbox-tab">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-bold text-[#9ca3af]">
          未処理の依頼 {candidates.length} 件
        </p>
        <button
          type="button"
          onClick={() => void refreshCandidates()}
          className="p-1 rounded-lg hover:bg-[#f3f4f6] text-[#9ca3af]"
          aria-label="更新"
          data-testid="inbox-refresh"
        >
          <RefreshCw
            size={14}
            className={candidatesLoading ? "animate-spin" : ""}
          />
        </button>
      </div>

      {candidates.length === 0 ? (
        candidatesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-[#f97316] border-t-transparent animate-spin" />
          </div>
        ) : (
          <EmptyState
            icon={<Inbox size={36} />}
            title="新しい依頼はありません"
            hint="Slack に自分宛てのメッセージが届くとここに並びます"
          />
        )
      ) : (
        candidates.map((cand) => (
          <CandidateCard
            key={cand.candidateId}
            candidate={cand}
            onApprove={() => setModal({ kind: "approve", candidate: cand })}
            onDecline={() => setModal({ kind: "decline", candidate: cand })}
            onDismiss={() => removeCandidate(cand.candidateId)}
          />
        ))
      )}

      {modal.kind === "approve" && (
        <ApprovalModal
          candidate={modal.candidate}
          onClose={closeModal}
          onApproved={() => {
            removeCandidate(modal.candidate.candidateId);
            void refreshTasks();
          }}
          onDelegationStart={onDelegationStart}
        />
      )}
      {modal.kind === "decline" && (
        <DeclineModal
          candidate={modal.candidate}
          onClose={closeModal}
          onDeclined={() => removeCandidate(modal.candidate.candidateId)}
        />
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  onApprove,
  onDecline,
  onDismiss,
}: {
  candidate: TaskCandidate;
  onApprove: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}) {
  const deadlineLabel = candidate.deadline
    ? new Date(candidate.deadline).toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
      })
    : "未指定";

  return (
    <Card data-testid="candidate-card">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Badge tone="orange">AI抽出</Badge>
        <Badge tone="slack">Slack</Badge>
        <span className="ml-auto text-[10px] text-[#9ca3af]">
          {candidate.requester}
        </span>
      </div>
      <p
        className="text-sm text-[#1f2937] leading-relaxed line-clamp-2 mb-2"
        data-testid="candidate-title"
      >
        {candidate.title}
      </p>
      <p className="text-[10px] text-[#9ca3af] mb-2.5">締切: {deadlineLabel}</p>
      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1 py-1.5 text-xs"
          onClick={onApprove}
          data-testid="candidate-approve"
        >
          承認
        </Button>
        <Button
          variant="outline"
          className="flex-1 py-1.5 text-xs"
          onClick={onDecline}
          data-testid="candidate-decline"
        >
          お断り
        </Button>
        <Button
          variant="ghost"
          className="shrink-0 h-8 w-8 p-0 text-[#9ca3af] hover:text-[#ef4444]"
          onClick={onDismiss}
          aria-label="消去"
          data-testid="candidate-dismiss"
          title="消去"
        >
          <Trash2 size={15} aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}
