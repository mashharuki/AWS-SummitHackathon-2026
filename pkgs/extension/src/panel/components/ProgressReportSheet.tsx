/**
 * ProgressReportSheet — ⑤動いてるフリ（自然な進捗報告）
 *
 * モック(11.34.01)準拠。タスクが既に終わっていても/手をつけていなくても、
 * re:Invent 調査タスク用の自然な仮の進捗報告文をデモ固定で表示し、
 *「この文章を送る」で DOM 送信（自分のアカウント）。
 *「もっと柔らかく」ではデモ文面に戻す。
 */

import { useSaborou } from "@/panel/SaborouContext";
import { Button, Modal } from "@/panel/components/ui";
import type { TaskSummary } from "@/panel/lib/types";
import { CheckCircle, Loader2, Sparkles, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Phase = "drafting" | "review" | "sending" | "sent" | "error";

const PITCH_DEMO_TASK_TITLE =
  "AWS re:Invent ラスベガスで回るセッションと展示ブース計画";
const PITCH_DEMO_REPORT_TEXT =
  "現在、AWS re:Inventでどのような出展企業があるのかをリスト化して整理しています。気になる企業や展示ブースを優先度ごとに見られるようにまとめているので、進捗があれば随時共有しますね。";

export function ProgressReportSheet({
  task,
  reportIndex,
  reportTotal,
  onClose,
  onSent,
}: {
  task: TaskSummary;
  reportIndex: number;
  reportTotal: number;
  onClose: () => void;
  onSent?: () => void;
}) {
  const { sendSlackViaDom, notifyReplyCompleted } = useSaborou();
  const [phase, setPhase] = useState<Phase>("drafting");
  const [reportText, setReportText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const progressLabel = `${reportIndex}/${reportTotal}`;
  const displayTaskTitle =
    task.title.includes("ラスベガス") || task.title.includes("re:Invent")
      ? task.title
      : PITCH_DEMO_TASK_TITLE;

  const generate = useCallback(() => {
    setPhase("drafting");
    setError(null);
    setReportText(PITCH_DEMO_REPORT_TEXT);
    setPhase("review");
  }, []);

  useEffect(() => {
    void generate();
  }, [generate]);

  const handleSend = async () => {
    setPhase("sending");
    setError(null);
    const res = await sendSlackViaDom(reportText);
    if (res.ok) {
      setPhase("sent");
      onSent?.();
      notifyReplyCompleted();
      setTimeout(onClose, 1100);
    } else {
      setError(res.error ?? "Slack 送信に失敗しました");
      setPhase("error");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>送っていいですか？</span>
          <span
            className="rounded-full border-2 border-saboru-heavy bg-white px-2 py-0.5 text-[10px] font-black text-saboru-orange shadow-[0_2px_0_#2b1e16]"
            data-testid="report-progress"
            aria-label={`進捗報告 ${progressLabel}`}
          >
            {progressLabel}
          </span>
        </div>
      }
      footer={
        phase === "review" ? (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => void generate()}
            >
              もっと柔らかく
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSend}
              data-testid="report-send"
            >
              この文章を送る
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="mb-3 p-2 rounded-xl bg-white border-2 border-[#f3f4f6]">
        <p className="text-[10px] font-bold text-[#9ca3af] mb-0.5">
          対象タスク
        </p>
        <p className="text-xs text-[#1f2937] line-clamp-2">
          {displayTaskTitle}
        </p>
      </div>

      {phase === "drafting" && (
        <div className="flex items-center gap-2 py-6 justify-center">
          <Loader2 size={16} className="text-[#f97316] animate-spin" />
          <p className="text-sm text-[#f97316] font-bold">
            進捗報告を作成しています...
          </p>
        </div>
      )}

      {(phase === "review" || phase === "sending" || phase === "sent") && (
        <div data-testid="report-review">
          <div className="flex items-center gap-1 mb-1">
            <Sparkles size={12} className="text-[#f97316]" />
            <p className="text-[10px] font-bold text-[#9ca3af]">
              SABOROU の進捗報告案
            </p>
          </div>
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            disabled={phase !== "review"}
            rows={5}
            className="w-full p-2.5 text-sm rounded-xl border-2 border-[#2b1e16] outline-none focus:border-[#f97316] bg-white text-[#1f2937] resize-none disabled:bg-[#f9fafb]"
            data-testid="report-draft"
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
                進捗報告を送信しました
              </p>
            </div>
          )}
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-col gap-3 py-2" data-testid="report-error">
          <div className="flex items-start gap-2">
            <XCircle size={16} className="text-[#ef4444] mt-0.5" />
            <p className="text-xs text-[#ef4444]">{error}</p>
          </div>
          <Button variant="outline" onClick={() => void generate()}>
            やり直す
          </Button>
        </div>
      )}
    </Modal>
  );
}
