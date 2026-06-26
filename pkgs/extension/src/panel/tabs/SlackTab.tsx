/**
 * SlackTab — 余白タブの復帰チェック UI と自動スケジュール連携
 */

import {
  RECOVERY_CHECK_OFFSET_MINUTES,
  computeRecoveryCheckWhen,
  formatRecoveryCheckTime,
} from "@/background/recoveryCheck";
import type {
  CheckActiveTaskScreenResponse,
  RecoveryCheckResultMessage,
} from "@/messages";
import { useSaborou } from "@/panel/SaborouContext";
import { ProgressReportSheet } from "@/panel/components/ProgressReportSheet";
import { Button } from "@/panel/components/ui";
import { getProgressReport } from "@/panel/lib/agentClient";
import type { TaskSummary } from "@/panel/lib/types";
import { Camera, CheckCircle, Coffee, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const ATTACK_ON_TITAN_PRIME_VIDEO_URL =
  "https://www.amazon.co.jp/gp/video/detail/B0B8S2V3V7?qid=1782281464029&pageTypeIdSource=ASIN&ref_=atv_sr_fle_c_Tn74RA_1_1_1&sr=1-1&pageTypeId=B0B8S51G5H";

type RecoveryCheckState =
  | "idle"
  | "scheduled"
  | "checking"
  | "matched"
  | "unmatched";

function applyRecoveryCheckResult(
  res: CheckActiveTaskScreenResponse,
  setTitle: (title: string | null) => void,
  setState: (state: RecoveryCheckState) => void,
) {
  setTitle(res.title ?? null);
  setState(res.ok && res.matched ? "matched" : "unmatched");
}

function getStartLabel(task: TaskSummary | null): string | null {
  if (!task?.deadline) return null;
  const date = new Date(task.deadline);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getRecoveryCheckLabel(startLabel: string | null): string | null {
  if (!startLabel) return null;
  return formatRecoveryCheckTime(
    computeRecoveryCheckWhen(startLabel, RECOVERY_CHECK_OFFSET_MINUTES),
  );
}

function getNextTaskPoints(task: TaskSummary): string[] {
  if (task.plannedSteps?.length) {
    return task.plannedSteps.slice(0, 3).map((step) => step.stepLabel);
  }
  return [
    `${task.title}で最初に開く資料を確認`,
    "最初の15分でやることを3つに絞る",
    "必要な返信や共有先を先に決める",
  ];
}

export function SlackTab() {
  const { jwt, chatMessages, offerVideoContinuation, freeTimeSession } =
    useSaborou();
  const [showReport, setShowReport] = useState(false);
  const [reportTextOverride, setReportTextOverride] = useState<string | null>(
    null,
  );
  const [reportLoading, setReportLoading] = useState(false);
  const [sentReportCounts, setSentReportCounts] = useState<
    Record<string, number>
  >({});
  const [completedReportMessageId, setCompletedReportMessageId] = useState<
    string | null
  >(null);
  const [completedVideoMessageId, setCompletedVideoMessageId] = useState<
    string | null
  >(null);
  const [expandedNextTaskMessageId, setExpandedNextTaskMessageId] = useState<
    string | null
  >(null);
  const [recoveryCheckState, setRecoveryCheckState] =
    useState<RecoveryCheckState>("idle");
  const [recoveryCheckTitle, setRecoveryCheckTitle] = useState<string | null>(
    null,
  );
  const progressReportFollowupsOfferedRef = useRef(false);
  const recoveryCheckScheduledRef = useRef(false);
  const lastRecoveryCheckedAtRef = useRef<string | null>(null);

  const handleRecoveryResult = useCallback(
    (result: RecoveryCheckResultMessage["result"]) => {
      if (lastRecoveryCheckedAtRef.current === result.checkedAt) return;
      lastRecoveryCheckedAtRef.current = result.checkedAt;
      applyRecoveryCheckResult(
        result,
        setRecoveryCheckTitle,
        setRecoveryCheckState,
      );
    },
    [],
  );

  useEffect(() => {
    void chrome.runtime
      .sendMessage({ type: "GET_PENDING_RECOVERY_CHECK" })
      .then((response: { result?: RecoveryCheckResultMessage["result"] }) => {
        if (response?.result) handleRecoveryResult(response.result);
      })
      .catch(() => {});
  }, [handleRecoveryResult]);

  useEffect(() => {
    const listener = (message: unknown) => {
      const runtimeMessage = message as RecoveryCheckResultMessage | null;
      if (runtimeMessage?.type === "RECOVERY_CHECK_RESULT") {
        handleRecoveryResult(runtimeMessage.result);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [handleRecoveryResult]);

  const nextTaskStartLabel = getStartLabel(freeTimeSession.nextTask);
  const recoveryCheckLabel = getRecoveryCheckLabel(nextTaskStartLabel);

  useEffect(() => {
    if (
      !expandedNextTaskMessageId ||
      recoveryCheckScheduledRef.current ||
      !freeTimeSession.nextTask ||
      !nextTaskStartLabel
    ) {
      return;
    }
    recoveryCheckScheduledRef.current = true;
    setRecoveryCheckState("scheduled");

    void chrome.runtime.sendMessage({
      type: "SCHEDULE_RECOVERY_CHECK",
      startLabel: nextTaskStartLabel,
      expectedTitle: freeTimeSession.nextTask.title,
      offsetMinutes: RECOVERY_CHECK_OFFSET_MINUTES,
    });

    void chrome.runtime
      .sendMessage({ type: "GET_PENDING_RECOVERY_CHECK" })
      .then((response: { result?: RecoveryCheckResultMessage["result"] }) => {
        if (response?.result) handleRecoveryResult(response.result);
      })
      .catch(() => {});
  }, [
    expandedNextTaskMessageId,
    freeTimeSession.nextTask,
    handleRecoveryResult,
    nextTaskStartLabel,
  ]);

  const activeTask = freeTimeSession.task;
  const reportTotal = activeTask?.plannedSteps?.length
    ? activeTask.plannedSteps.length
    : 5;
  const reportIndex = activeTask
    ? Math.min((sentReportCounts[activeTask.taskId] ?? 0) + 1, reportTotal)
    : 1;

  const handleProgressReportClick = async (messageId: string) => {
    if (!activeTask || !jwt) return;
    setReportTextOverride(null);
    setReportLoading(true);
    setShowReport(true);
    setCompletedReportMessageId(messageId);
    if (!progressReportFollowupsOfferedRef.current) {
      progressReportFollowupsOfferedRef.current = true;
      offerVideoContinuation();
    }
    try {
      const report = await getProgressReport(activeTask.taskId, jwt);
      setReportTextOverride(report.reportText);
    } catch (err) {
      console.warn("[SlackTab] getProgressReport failed:", err);
      setReportTextOverride(null);
    } finally {
      setReportLoading(false);
    }
  };

  const handleWatchVideoClick = (messageId: string) => {
    chrome.tabs.create({ url: ATTACK_ON_TITAN_PRIME_VIDEO_URL });
    setCompletedVideoMessageId(messageId);
  };

  const nextTaskPoints = freeTimeSession.nextTask
    ? getNextTaskPoints(freeTimeSession.nextTask)
    : [];

  return (
    <div className="flex flex-col h-full" data-testid="slack-tab">
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {chatMessages.map((m) =>
          m.role === "user" ? (
            <div
              key={m.id}
              className="flex justify-end"
              data-testid="chat-user"
            >
              <div className="max-w-[80%] p-2.5 rounded-xl rounded-tr-sm bg-saboru-orange text-white border-2 border-saboru-heavy shadow-[0_3px_0_#2b1e16]">
                <p className="text-sm leading-relaxed">{m.text}</p>
              </div>
            </div>
          ) : (
            <div
              key={m.id}
              className="flex flex-col gap-2"
              data-testid="chat-saborou-group"
            >
              {m.text ? (
                <div className="flex gap-2" data-testid="chat-saborou">
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-saboru-orange border-2 border-saboru-heavy shadow-[0_2px_0_#2b1e16] flex items-center justify-center text-white font-black text-[10px]">
                    サ
                  </div>
                  <div className="flex-1 p-2.5 rounded-xl rounded-tl-sm bg-white border-2 border-saboru-heavy shadow-[0_3px_0_#2b1e16]">
                    <p className="whitespace-pre-line text-sm text-saboru-ink leading-relaxed">
                      {m.text}
                    </p>
                  </div>
                </div>
              ) : null}
              {m.action === "progress_report" && (
                <div
                  className="ml-9 rounded-2xl border-2 border-saboru-heavy bg-saboru-cream p-3 shadow-[0_3px_0_#2b1e16]"
                  data-testid="progress-report-ticket"
                >
                  <p className="text-[10px] font-black tracking-[0.08em] text-saboru-ink-muted">
                    定期的に進捗報告代行
                  </p>
                  <Button
                    variant="primary"
                    className="mt-2 w-full py-1.5 text-xs"
                    disabled={!activeTask || !jwt || reportLoading}
                    onClick={() => handleProgressReportClick(m.id)}
                    data-testid="chat-saborou-report"
                  >
                    {reportLoading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Coffee size={13} />
                    )}
                    {reportLoading ? "作成中" : "SABOROU"}
                  </Button>
                </div>
              )}
              {m.action === "progress_report" &&
                completedReportMessageId === m.id && (
                  <div
                    className="ml-9 rounded-2xl border-2 border-saboru-heavy bg-[#d1fae5] p-3 shadow-[0_3px_0_#2b1e16]"
                    data-testid="progress-report-sent-ticket"
                  >
                    <p className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.08em] text-[#065f46]">
                      <CheckCircle size={13} />
                      進捗報告完了
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-[#065f46]/80">
                      送信済み
                    </p>
                  </div>
                )}
              {m.action === "watch_video" && (
                <div
                  className="ml-9 rounded-2xl border-2 border-saboru-heavy bg-saboru-cream p-3 shadow-[0_3px_0_#2b1e16]"
                  data-testid="watch-video-ticket"
                >
                  <p className="text-[10px] font-black tracking-[0.08em] text-saboru-ink-muted">
                    アニメの続き
                  </p>
                  <Button
                    variant="primary"
                    className="mt-2 w-full py-1.5 text-xs"
                    onClick={() => handleWatchVideoClick(m.id)}
                    data-testid="chat-saborou-watch-video"
                  >
                    <Coffee size={13} />
                    SABOROU
                  </Button>
                </div>
              )}
              {m.action === "watch_video" &&
                completedVideoMessageId === m.id && (
                  <>
                    <div
                      className="ml-9 rounded-2xl border-2 border-saboru-heavy bg-[#d1fae5] p-3 shadow-[0_3px_0_#2b1e16]"
                      data-testid="watch-video-complete-ticket"
                    >
                      <p className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.08em] text-[#065f46]">
                        <CheckCircle size={13} />
                        アニメ視聴完了
                      </p>
                      <p className="mt-1 text-[11px] font-bold text-[#065f46]/80">
                        視聴済み
                      </p>
                    </div>

                    <div
                      className="ml-9 rounded-2xl border-2 border-saboru-heavy bg-saboru-cream p-3 shadow-[0_3px_0_#2b1e16]"
                      data-testid="next-task-prep-ticket"
                    >
                      <p className="text-[10px] font-black tracking-[0.08em] text-saboru-ink-muted">
                        次タスク準備
                      </p>
                      {freeTimeSession.nextTask ? (
                        <>
                          <p className="mt-1 text-xs font-bold leading-relaxed text-saboru-ink">
                            次のタスクは
                            {nextTaskStartLabel
                              ? `${nextTaskStartLabel}開始`
                              : "開始時刻未確定"}
                            。そろそろ準備しよっか。概要だけ確認しとく？
                          </p>
                          <Button
                            variant="primary"
                            className="mt-2 w-full py-1.5 text-xs"
                            onClick={() => setExpandedNextTaskMessageId(m.id)}
                            data-testid="chat-saborou-next-task-summary"
                          >
                            <Coffee size={13} />
                            SABOROU
                          </Button>
                        </>
                      ) : (
                        <p className="mt-1 text-xs font-bold leading-relaxed text-saboru-ink">
                          次の予定は未検出。余白だけ味わって、戻る前に最初の一手を決めよう。
                        </p>
                      )}
                    </div>

                    {expandedNextTaskMessageId === m.id &&
                      freeTimeSession.nextTask && (
                        <>
                          <div
                            className="ml-9 overflow-hidden rounded-2xl border-2 border-saboru-heavy bg-white shadow-[0_3px_0_#2b1e16]"
                            data-testid="next-task-summary-card"
                          >
                            <div className="bg-saboru-orange px-3 py-2 text-white">
                              <p className="text-[10px] font-black tracking-[0.12em] opacity-80">
                                次のタスク概要
                              </p>
                              <p className="mt-0.5 text-base font-black leading-tight">
                                {freeTimeSession.nextTask.title}
                              </p>
                            </div>
                            <div className="p-3">
                              <div className="flex flex-wrap gap-1.5">
                                <span className="rounded-full border border-saboru-heavy bg-saboru-cream px-2 py-0.5 text-[10px] font-black text-saboru-ink">
                                  {nextTaskStartLabel
                                    ? `${nextTaskStartLabel}開始`
                                    : "開始時刻未確定"}
                                </span>
                                <span className="rounded-full border border-saboru-heavy bg-[#d1fae5] px-2 py-0.5 text-[10px] font-black text-[#065f46]">
                                  準備あと10分
                                </span>
                              </div>
                              <div className="mt-3 rounded-xl border border-saboru-line bg-saboru-cream/70 p-2.5">
                                <p className="text-[10px] font-black tracking-[0.08em] text-saboru-ink-muted">
                                  今日見ること
                                </p>
                                <ul className="mt-2 flex flex-col gap-1.5">
                                  {nextTaskPoints.map((point) => (
                                    <li
                                      key={point}
                                      className="flex gap-1.5 text-xs font-bold leading-relaxed text-saboru-ink"
                                    >
                                      <CheckCircle
                                        size={12}
                                        className="mt-0.5 shrink-0 text-saboru-orange"
                                      />
                                      <span>{point}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>

                          {nextTaskStartLabel && recoveryCheckLabel && (
                            <div
                              className="ml-9 rounded-2xl border-2 border-saboru-heavy bg-saboru-cream p-3 shadow-[0_3px_0_#2b1e16]"
                              data-testid="recovery-check-ticket"
                            >
                              <p className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.08em] text-saboru-ink-muted">
                                <Camera size={13} />
                                自動画面読み取りチェック
                              </p>
                              <p className="mt-1 text-xs font-bold leading-relaxed text-saboru-ink">
                                {recoveryCheckLabel}
                                ごろに、こっちから画面を読み取って次タスクへの切り替えを確認するね。
                              </p>
                              {recoveryCheckState === "scheduled" && (
                                <p
                                  className="mt-2 text-[11px] font-bold text-saboru-ink-muted"
                                  data-testid="recovery-check-scheduled"
                                >
                                  自動確認を予約済み。着手できていたら褒めるよ。
                                </p>
                              )}
                              {recoveryCheckState === "checking" && (
                                <p
                                  className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-saboru-ink-muted"
                                  data-testid="recovery-check-status"
                                >
                                  <Loader2 size={12} className="animate-spin" />
                                  画面を読み取って、次タスクっぽいか確認中...
                                </p>
                              )}
                              {recoveryCheckState === "matched" && (
                                <div
                                  className="mt-2 rounded-xl border-2 border-[#065f46] bg-[#d1fae5] p-2"
                                  data-testid="recovery-check-success"
                                >
                                  <p className="flex items-center gap-1.5 text-xs font-black text-[#065f46]">
                                    <CheckCircle size={14} />
                                    次の仕事やってるの偉いよ
                                  </p>
                                  <p className="mt-1 text-[11px] font-bold leading-relaxed text-[#065f46]/80">
                                    {recoveryCheckTitle
                                      ? `${recoveryCheckTitle} を確認したよ。`
                                      : "タスク画面への切り替えを確認したよ。"}
                                  </p>
                                </div>
                              )}
                              {recoveryCheckState === "unmatched" && (
                                <div
                                  className="mt-2 rounded-xl border-2 border-saboru-heavy bg-white p-2"
                                  data-testid="recovery-check-unmatched"
                                >
                                  <p className="text-xs font-black text-saboru-ink">
                                    まだ次タスク画面とは言い切れないかも。
                                  </p>
                                  <p className="mt-1 text-[11px] font-bold leading-relaxed text-saboru-ink-muted">
                                    {freeTimeSession.nextTask.title}
                                    が見える画面に切り替わったら、またこっちから確認するね。
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                  </>
                )}
            </div>
          ),
        )}
      </div>

      {showReport && activeTask && (
        <ProgressReportSheet
          task={activeTask}
          reportIndex={reportIndex}
          reportTotal={reportTotal}
          initialReportText={reportTextOverride}
          loading={reportLoading}
          onClose={() => setShowReport(false)}
          onSent={() =>
            setSentReportCounts((prev) => ({
              ...prev,
              [activeTask.taskId]: Math.min(
                (prev[activeTask.taskId] ?? 0) + 1,
                reportTotal,
              ),
            }))
          }
        />
      )}
    </div>
  );
}
