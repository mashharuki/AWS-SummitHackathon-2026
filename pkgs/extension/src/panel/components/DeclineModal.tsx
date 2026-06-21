/**
 * DeclineModal — お断りフロー
 *
 * モック(11.41.56)準拠: 候補を「お断り」したとき、丁寧な断り文面案を生成・提示し、
 *「この文面で送る」で DOM 送信（自分のアカウント）。送信後に候補を却下する。
 *
 * 断り文面は judge API（saborou_judge_sabori → 返信ドラフト）に
 *「丁重にお断りする」コンテキストを付けて生成する。
 */

import { useSaborou } from "@/panel/SaborouContext";
import { Button, Modal } from "@/panel/components/ui";
import { judgeTask, rejectCandidate } from "@/panel/lib/agentClient";
import type { TaskCandidate } from "@/panel/lib/types";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type Phase = "drafting" | "review" | "sending" | "sent" | "error";

export function DeclineModal({
  candidate,
  onClose,
  onDeclined,
}: {
  candidate: TaskCandidate;
  onClose: () => void;
  onDeclined: () => void;
}) {
  const { jwt, sendSlackViaDom } = useSaborou();
  const [phase, setPhase] = useState<Phase>("drafting");
  const [replyDraft, setReplyDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  // モーダルを開いたら断り文面を生成
  useEffect(() => {
    if (!jwt) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await judgeTask(
          {
            message: `次の依頼を丁重にお断りする返信文を作ってください: ${candidate.description}`,
            senderName: candidate.requester,
          },
          jwt,
        );
        if (!cancelled) {
          setReplyDraft(result.replyDraft);
          setPhase("review");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "断り文面の生成に失敗しました",
          );
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jwt, candidate]);

  const handleSend = async () => {
    setPhase("sending");
    setError(null);
    const res = await sendSlackViaDom(replyDraft);
    if (!res.ok) {
      setError(res.error ?? "Slack 送信に失敗しました");
      setPhase("error");
      return;
    }
    // 送信成功 → 候補を却下（API 候補のみ。live 候補は API 削除不要）
    if (jwt && !candidate.candidateId.startsWith("live:")) {
      try {
        await rejectCandidate(candidate.candidateId, jwt);
      } catch (err) {
        console.warn("[SABOROU] rejectCandidate failed (ignored):", err);
      }
    }
    setPhase("sent");
    setTimeout(() => {
      onDeclined();
      onClose();
    }, 1100);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="お断りの文面"
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
              data-testid="decline-send"
            >
              この文面で送る
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="mb-3 p-2 rounded-xl bg-white border-2 border-[#f3f4f6]">
        <p className="text-[10px] font-bold text-[#9ca3af] mb-0.5">
          {candidate.requester} さんからの依頼
        </p>
        <p className="text-xs text-[#1f2937] leading-relaxed line-clamp-3">
          {candidate.title}
        </p>
      </div>

      {phase === "drafting" && (
        <div className="flex items-center gap-2 py-6 justify-center">
          <Loader2 size={16} className="text-[#f97316] animate-spin" />
          <p className="text-sm text-[#f97316] font-bold">
            角が立たない断り方を考えています...
          </p>
        </div>
      )}

      {(phase === "review" || phase === "sending" || phase === "sent") && (
        <div data-testid="decline-review">
          <p className="text-[10px] font-bold text-[#9ca3af] mb-1">
            SABOROU の断り文案
          </p>
          <textarea
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            disabled={phase !== "review"}
            rows={5}
            className="w-full p-2.5 text-sm rounded-xl border-2 border-[#2b1e16] outline-none focus:border-[#f97316] bg-white text-[#1f2937] resize-none disabled:bg-[#f9fafb]"
            data-testid="decline-draft"
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
                お断りを送信しました
              </p>
            </div>
          )}
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-col gap-3 py-2" data-testid="decline-error">
          <div className="flex items-start gap-2">
            <XCircle size={16} className="text-[#ef4444] mt-0.5" />
            <p className="text-xs text-[#ef4444]">{error}</p>
          </div>
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
        </div>
      )}
    </Modal>
  );
}
