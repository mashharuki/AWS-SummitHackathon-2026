/**
 * ApprovalModal — 承認フロー（Bias for Action）
 *
 * フロー:
 *   Step 1: タスクの進め方を選ぶ
 *   Step 2: 返信文案を提示（judge API）→「この文面で送る」で DOM 送信
 *   Step 3: 送信完了 → タスク種別を判定して適切な代行ボタンを表示
 *
 * 送信は SaborouContext.sendSlackViaDom（content script → Slack DOM = 自分アカウント）。
 */

import { useSaborou } from "@/panel/SaborouContext";
import { Button, Modal } from "@/panel/components/ui";
import {
  approveCandidate,
  decomposeTask,
  delegateTask,
  judgeTask,
} from "@/panel/lib/agentClient";
import type { TaskCandidate, TaskSummary } from "@/panel/lib/types";
import { CheckCircle, Loader2, Lock, XCircle, Zap } from "lucide-react";
import { useState } from "react";

// ---------------------------------------------------------------------------
// タスク種別判定
// ---------------------------------------------------------------------------

type TaskType = "travel" | "slides" | "general";

function detectTaskTypes(candidate: TaskCandidate): TaskType[] {
  const text = `${candidate.title} ${candidate.description}`.toLowerCase();
  const types: TaskType[] = [];
  if (/旅程|出張|旅行|新幹線|ホテル|宿泊|交通|航空/.test(text))
    types.push("travel");
  if (/スライド|資料|プレゼン|presentation|slide|docs/.test(text))
    types.push("slides");
  if (types.length === 0) types.push("general");
  return types;
}

const TASK_ACTION_CONFIG: Record<
  TaskType,
  { emoji: string; label: string; instruction: string }
> = {
  travel: {
    emoji: "✈️",
    label: "旅行プランを作成",
    instruction: "旅程計画・新幹線・ホテルの手配を行う",
  },
  slides: {
    emoji: "📊",
    label: "スライドを作成",
    instruction: "社内共有スライドを作成する",
  },
  general: {
    emoji: "🤖",
    label: "Claudeに委譲",
    instruction: "タスクをAIが代行する",
  },
};

// ---------------------------------------------------------------------------
// Phase / Approaches
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApprovalModal({
  candidate,
  onClose,
  onApproved,
  onDelegationStart,
}: {
  candidate: TaskCandidate;
  onClose: () => void;
  onApproved: () => void;
  onDelegationStart?: () => void;
}) {
  const { jwt, sendSlackViaDom, notifyReplyCompleted, registerDelegatedTask } =
    useSaborou();
  const [phase, setPhase] = useState<Phase>("choose");
  const [replyDraft, setReplyDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [approvedTask, setApprovedTask] = useState<TaskSummary | null>(null);

  const taskTypes = detectTaskTypes(candidate);

  // 進め方を選んだら返信文案を生成
  const handleChoose = async (approachId: string) => {
    if (approachId !== "bias-for-action" || !jwt) return;
    setPhase("drafting");
    setError(null);
    try {
      const result = await judgeTask(
        {
          message: [
            "次の依頼を受ける返信文を作ってください。",
            "Bias for Action 型として、まず着手する姿勢と、守れる範囲の見通しを短く伝えてください。",
            "余計な約束を増やさず、必要なら「確認できる範囲から先に戻す」方向にしてください。",
            `依頼内容: ${candidate.description}`,
          ].join("\n"),
          senderName: candidate.requester,
        },
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
      setTimeout(() => setPhase("delegate_prompt"), 800);
    } else {
      setError(res.error ?? "Slack 送信に失敗しました");
      setPhase("error");
    }
  };

  const handleDelegate = async (instruction: string) => {
    if (!jwt) return;
    setPhase("delegating");
    try {
      const channelId = candidate.slackChannelId ?? "";
      let taskId = approvedTask?.taskId;
      if (!taskId) {
        try {
          // live: 候補はバックエンド未登録のため失敗することがあるが無視して続行
          const task = await approveCandidate(candidate.candidateId, jwt);
          setApprovedTask(task);
          registerDelegatedTask(task);
          taskId = task.taskId;
        } catch {
          // noop — アニメーションは続行する
        }
      }
      if (taskId) {
        // Fire decompose in parallel to warm up Bedrock before WorkingTab loads.
        // Result is ignored here — WorkingTab will call decomposeTask independently.
        void decomposeTask(taskId, jwt).catch(() => undefined);
        await delegateTask(taskId, channelId, jwt, { instruction });
      }
      setPhase("delegate_done");
      setTimeout(() => {
        onApproved();
        onDelegationStart?.();
        onClose();
      }, 1000);
    } catch (err) {
      if (err instanceof Error && err.message.includes("SLACK_NOT_CONNECTED")) {
        setError(
          "Slack が未連携です。設定タブから Slack 連携を完了してください。",
        );
      } else {
        setError(err instanceof Error ? err.message : "代行依頼に失敗しました");
      }
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
        <div className="flex flex-col gap-2" data-testid="delegate-prompt">
          <p className="text-[10px] font-bold text-[#9ca3af] mb-1">
            AIに代行してもらう作業を選んでください
          </p>
          {taskTypes.map((type) => {
            const cfg = TASK_ACTION_CONFIG[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => void handleDelegate(cfg.instruction)}
                className="w-full py-2.5 px-3 rounded-xl text-sm font-bold bg-[#f97316] text-white border-2 border-[#2b1e16] shadow-[0_3px_0_#2b1e16] active:translate-y-[3px] active:shadow-none transition-all text-left flex items-center gap-2"
                data-testid={`delegate-${type}`}
              >
                <span className="text-base">{cfg.emoji}</span>
                <div>
                  <p className="text-sm font-bold">{cfg.label}</p>
                  <p className="text-[10px] text-white/80">{cfg.instruction}</p>
                </div>
              </button>
            );
          })}
          {/* 「general」が taskTypes に含まれていない場合も Claude 委譲を常時表示 */}
          {!taskTypes.includes("general") && (
            <button
              type="button"
              onClick={() =>
                void handleDelegate(TASK_ACTION_CONFIG.general.instruction)
              }
              className="w-full py-2.5 px-3 rounded-xl text-sm font-bold bg-white text-[#1f2937] border-2 border-[#2b1e16] shadow-[0_3px_0_#2b1e16] active:translate-y-[3px] active:shadow-none transition-all text-left flex items-center gap-2"
              data-testid="delegate-general"
            >
              <span className="text-base">🤖</span>
              <div>
                <p className="text-sm font-bold">Claudeに委譲</p>
                <p className="text-[10px] text-[#9ca3af]">
                  {TASK_ACTION_CONFIG.general.instruction}
                </p>
              </div>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onApproved();
              onClose();
            }}
            className="text-[11px] text-[#9ca3af] underline text-center mt-1"
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
