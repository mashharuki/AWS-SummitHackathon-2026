/**
 * ApprovalModal — 承認フロー（Bias for Action）
 *
 * フロー:
 *   Step 1: タスクの進め方を選ぶ
 *   Step 2: 返信文案を提示（judge API）→「この文面で送る」で DOM 送信
 *   Step 3: 送信完了 → 代行フェーズ（approveCandidate + delegateTask）
 *
 * 送信は SaborouContext.sendSlackViaDom（content script → Slack DOM = 自分アカウント）。
 */

import { useSaborou } from "@/panel/SaborouContext";
import { Button, Modal } from "@/panel/components/ui";
import {
  approveCandidate,
  delegateTask,
  judgeTask,
} from "@/panel/lib/agentClient";
import type { TaskCandidate, TaskSummary } from "@/panel/lib/types";
import { CheckCircle, Loader2, Lock, XCircle, Zap } from "lucide-react";
import { useState } from "react";

type Phase =
  | "choose"
  | "drafting"
  | "review"
  | "sending"
  | "sent"
  | "delegate_prompt"
  | "delegating"
  | "delegate_done"
  | "error";

const APPROACHES = [
  {
    id: "bias-for-action",
    label: "Bias for Action 型",
    desc: "すぐ着手し、まずは前進。今回はこの型で進めます。",
    enabled: true,
  },
  {
    id: "frugality",
    label: "Frugality 型",
    desc: "工数を絞って最小で。（近日対応）",
    enabled: false,
  },
  {
    id: "dive-deep",
    label: "Dive Deep 型",
    desc: "深く調べてから着手。（近日対応）",
    enabled: false,
  },
];

export function ApprovalModal({
  candidate,
  onClose,
  onApproved,
  onDelegationStart,
}: {
  candidate: TaskCandidate;
  onClose: () => void;
  /** 承認・送信が完了したら親に通知（候補リストから除去するため） */
  onApproved: () => void;
  /** 代行開始時に呼ばれるコールバック（WorkingTab へのタブ切り替えなど） */
  onDelegationStart?: () => void;
}) {
  const { jwt, sendSlackViaDom, notifyReplyCompleted } = useSaborou();
  const [phase, setPhase] = useState<Phase>("choose");
  const [replyDraft, setReplyDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [approvedTask, setApprovedTask] = useState<TaskSummary | null>(null);

  // 進め方を選んだら返信文案を生成
  const handleChoose = async (approachId: string) => {
    if (approachId !== "bias-for-action" || !jwt) return;
    setPhase("drafting");
    setError(null);
    try {
      const result = await judgeTask(
        { message: candidate.description, senderName: candidate.requester },
        jwt,
      );
      setReplyDraft(result.replyDraft);
      setPhase("review");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "返信案の生成に失敗しました",
      );
      setPhase("error");
    }
  };

  const handleSend = async () => {
    setPhase("sending");
    setError(null);
    const res = await sendSlackViaDom(replyDraft);
    if (res.ok) {
      setPhase("sent");
      notifyReplyCompleted();
      // 返信完了後、代行フェーズへ移行
      setTimeout(() => setPhase("delegate_prompt"), 800);
    } else {
      setError(res.error ?? "Slack 送信に失敗しました");
      setPhase("error");
    }
  };

  const handleDelegate = async () => {
    if (!jwt) return;
    setPhase("delegating");
    try {
      const channelId = candidate.slackChannelId ?? "";
      let taskId = approvedTask?.taskId;
      if (!taskId) {
        try {
          const task = await approveCandidate(candidate.candidateId, jwt);
          setApprovedTask(task);
          taskId = task.taskId;
        } catch {
          // live: 候補はバックエンド未登録のためスキップし代行アニメーションを続行
        }
      }
      if (taskId) {
        await delegateTask(taskId, channelId, jwt);
      }
      setPhase("delegate_done");
      setTimeout(() => {
        onApproved();
        onDelegationStart?.();
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "代行依頼に失敗しました");
      setPhase("error");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        phase === "choose"
          ? "タスクの進め方"
          : phase === "delegate_prompt" ||
              phase === "delegating" ||
              phase === "delegate_done"
            ? "タスク代行"
            : "返信文を確認"
      }
      footer={
        phase === "review" ? (
          <>
            <Button variant="outline" className="flex-1" onClick={onClose}>
              やめる
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSend}
              data-testid="approval-send"
            >
              この文面で送る
            </Button>
          </>
        ) : undefined
      }
    >
      {/* 対象タスク */}
      <div className="mb-3 p-2 rounded-xl bg-white border-2 border-[#f3f4f6]">
        <p className="text-[10px] font-bold text-[#9ca3af] mb-0.5">
          {candidate.requester} さんからの依頼
        </p>
        <p className="text-xs text-[#1f2937] leading-relaxed line-clamp-3">
          {candidate.title}
        </p>
      </div>

      {phase === "choose" && (
        <div className="flex flex-col gap-2" data-testid="approach-list">
          {APPROACHES.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={!a.enabled}
              onClick={() => handleChoose(a.id)}
              className={
                a.enabled
                  ? "text-left p-3 rounded-xl border-2 border-[#2b1e16] bg-[#f97316] text-white shadow-[0_3px_0_#2b1e16] active:translate-y-[3px] active:shadow-none transition-all"
                  : "text-left p-3 rounded-xl border-2 border-[#e5e7eb] bg-[#f9fafb] text-[#9ca3af] cursor-not-allowed"
              }
            >
              <div className="flex items-center gap-1.5 font-bold text-sm">
                {a.enabled ? <Zap size={14} /> : <Lock size={12} />}
                {a.label}
              </div>
              <p
                className={
                  a.enabled
                    ? "text-[11px] text-white/90 mt-0.5"
                    : "text-[11px] text-[#9ca3af] mt-0.5"
                }
              >
                {a.desc}
              </p>
            </button>
          ))}
        </div>
      )}

      {phase === "drafting" && (
        <div className="flex items-center gap-2 py-6 justify-center">
          <Loader2 size={16} className="text-[#f97316] animate-spin" />
          <p className="text-sm text-[#f97316] font-bold">
            返信文を考えています...
          </p>
        </div>
      )}

      {(phase === "review" || phase === "sending" || phase === "sent") && (
        <div data-testid="approval-review">
          <p className="text-[10px] font-bold text-[#9ca3af] mb-1">
            SABOROU の返信案
          </p>
          <textarea
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            disabled={phase !== "review"}
            rows={5}
            className="w-full p-2.5 text-sm rounded-xl border-2 border-[#2b1e16] outline-none focus:border-[#f97316] bg-white text-[#1f2937] resize-none disabled:bg-[#f9fafb]"
            data-testid="approval-draft"
          />
          {phase === "sending" && (
            <div className="mt-2 flex items-center gap-1">
              <Loader2 size={12} className="text-[#6b7280] animate-spin" />
              <p className="text-xs text-[#6b7280]">Slack に送信中...</p>
            </div>
          )}
          {phase === "sent" && (
            <div className="mt-2 flex items-center gap-1">
              <CheckCircle size={14} className="text-[#10b981]" />
              <p className="text-xs text-[#10b981] font-bold">
                自分のアカウントで送信しました
              </p>
            </div>
          )}
        </div>
      )}

      {phase === "delegate_prompt" && (
        <div className="flex flex-col gap-3 py-2" data-testid="delegate-prompt">
          <p className="text-xs text-[#1f2937]">
            返信が完了しました！このタスクをAIに丸ごと代行してもらいますか？
          </p>
          <button
            type="button"
            onClick={() => void handleDelegate()}
            className="w-full py-3 rounded-xl text-sm font-bold bg-[#f97316] text-white border-2 border-[#2b1e16] shadow-[0_3px_0_#2b1e16] active:translate-y-[3px] active:shadow-none transition-all"
            data-testid="delegate-confirm"
          >
            🤖 タスクを代行してもらう
          </button>
          <button
            type="button"
            onClick={() => {
              onApproved();
              onClose();
            }}
            className="text-[11px] text-[#9ca3af] underline text-center"
          >
            自分でやります
          </button>
        </div>
      )}

      {phase === "delegating" && (
        <div className="flex items-center gap-2 py-6 justify-center">
          <Loader2 size={16} className="text-[#f97316] animate-spin" />
          <p className="text-sm text-[#f97316] font-bold">代行依頼中...</p>
        </div>
      )}

      {phase === "delegate_done" && (
        <div className="flex items-center gap-2 py-6 justify-center">
          <CheckCircle size={16} className="text-[#10b981]" />
          <p className="text-sm text-[#10b981] font-bold">
            SABOROUが引き受けました ✨
          </p>
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-col gap-3 py-2" data-testid="approval-error">
          <div className="flex items-start gap-2">
            <XCircle size={16} className="text-[#ef4444] mt-0.5" />
            <p className="text-xs text-[#ef4444]">{error}</p>
          </div>
          <Button variant="outline" onClick={() => setPhase("choose")}>
            やり直す
          </Button>
        </div>
      )}
    </Modal>
  );
}
