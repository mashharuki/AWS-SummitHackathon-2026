/**
 * SlackTab — 余白タブの復帰チェック UI と自動スケジュール連携
 */

import type {
  CheckActiveTaskScreenResponse,
  RecoveryCheckResultMessage,
} from "@/messages";
import {
  RECOVERY_CHECK_OFFSET_MINUTES,
  computeRecoveryCheckWhen,
  formatRecoveryCheckTime,
} from "@/background/recoveryCheck";
import { useSaborou } from "@/panel/SaborouContext";
import { ProgressReportSheet } from "@/panel/components/ProgressReportSheet";
import { Button } from "@/panel/components/ui";
import { Camera, CheckCircle, Clock, Coffee, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const DEMO_COMPLETED_TASK_TITLE = "ラスベガスの計画書タスク";
const DEMO_NEXT_TASK_TITLE = "AIエージェント改善定例会";
const DEMO_NEXT_TASK_START_LABEL = "19:30";
const DEMO_NEXT_TASK_REMINDER_LABEL = "19:20";
const DEMO_FREE_MINUTES = 40;
const DEMO_NEXT_TASK_POINTS = [
  "AIエージェントの提案品質を確認",
  "サボり導線とチケット表示の違和感を調整",
  "デモで見せる流れを優先度順に整理",
];
const ATTACK_ON_TITAN_PRIME_VIDEO_URL =
  "https://www.amazon.co.jp/gp/video/detail/B0B8S2V3V7?qid=1782281464029&pageTypeIdSource=ASIN&ref_=atv_sr_fle_c_Tn74RA_1_1_1&sr=1-1&pageTypeId=B0B8S51G5H";

const DEMO_MARGIN_CHAT_MESSAGE = `よく頑張ったよ、ゆーたろ!${DEMO_COMPLETED_TASK_TITLE}、終了！ここは全力でサボろう。${DEMO_NEXT_TASK_REMINDER_LABEL}くらいから、またリマインドするね。`;

const DEMO_RECOVERY_CHECK_LABEL = formatRecoveryCheckTime(
  computeRecoveryCheckWhen(
    DEMO_NEXT_TASK_START_LABEL,
    RECOVERY_CHECK_OFFSET_MINUTES,
  ),
);

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

export function SlackTab() {
  const { tasks, chatMessages, offerVideoContinuation } = useSaborou();
  const [showReport, setShowReport] = useState(false);
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

  useEffect(() => {
    if (!expandedNextTaskMessageId || recoveryCheckScheduledRef.current) return;
    recoveryCheckScheduledRef.current = true;
    setRecoveryCheckState("scheduled");

    void chrome.runtime.sendMessage({
      type: "SCHEDULE_RECOVERY_CHECK",
      startLabel: DEMO_NEXT_TASK_START_LABEL,
      expectedTitle: DEMO_NEXT_TASK_TITLE,
      offsetMinutes: RECOVERY_CHECK_OFFSET_MINUTES,
    });

    void chrome.runtime
      .sendMessage({ type: "GET_PENDING_RECOVERY_CHECK" })
      .then((response: { result?: RecoveryCheckResultMessage["result"] }) => {
        if (response?.result) handleRecoveryResult(response.result);
      })
      .catch(() => {});
  }, [expandedNextTaskMessageId, handleRecoveryResult]);

  const activeTask = tasks[0] ?? null;
  const reportTotal = activeTask?.plannedSteps?.length
    ? activeTask.plannedSteps.length
    : 5;
  const reportIndex = activeTask
    ? Math.min((sentReportCounts[activeTask.taskId] ?? 0) + 1, reportTotal)
    : 1;

  const handleProgressReportClick = (messageId: string) => {
    setShowReport(true);
    setCompletedReportMessageId(messageId);
    if (!progressReportFollowupsOfferedRef.current) {
      progressReportFollowupsOfferedRef.current = true;
      offerVideoContinuation();
    }
  };

  const handleWatchVideoClick = (messageId: string) => {
    chrome.tabs.create({ url: ATTACK_ON_TITAN_PRIME_VIDEO_URL });
    setCompletedVideoMessageId(messageId);
  };

  return (
    <div className="flex flex-col h-full" data-testid="slack-tab">
      <NextTaskStatusCard
        taskTitle={DEMO_NEXT_TASK_TITLE}
        startLabel={DEMO_NEXT_TASK_START_LABEL}
        freeMinutes={DEMO_FREE_MINUTES}
      />

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        <div className="flex gap-2" data-testid="demo-chat-message">
          <div className="shrink-0 w-7 h-7 rounded-lg bg-saboru-orange border-2 border-saboru-heavy shadow-[0_2px_0_#2b1e16] flex items-center justify-center text-white font-black text-[10px]">
            サ
          </div>
          <div className="flex-1 p-2.5 rounded-xl rounded-tl-sm bg-white border-2 border-saboru-heavy shadow-[0_3px_0_#2b1e16]">
            <p className="text-xs text-saboru-ink leading-relaxed">
              {DEMO_MARGIN_CHAT_MESSAGE}
            </p>
          </div>
        </div>

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
                    <p className="text-sm text-saboru-ink leading-relaxed">
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
                    disabled={!activeTask}
                    onClick={() => handleProgressReportClick(m.id)}
                    data-testid="chat-saborou-report"
                  >
                    <Coffee size={13} />
                    SABOROU
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
                      <p className="mt-1 text-xs font-bold leading-relaxed text-saboru-ink">
                        あと10分で次のタスクだね。そろそろ準備しよっか。
                        次のタスク概要だけ確認しとく？
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
                    </div>

                    {expandedNextTaskMessageId === m.id && (
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
                              {DEMO_NEXT_TASK_TITLE}
                            </p>
                          </div>
                          <div className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              <span className="rounded-full border border-saboru-heavy bg-saboru-cream px-2 py-0.5 text-[10px] font-black text-saboru-ink">
                                {DEMO_NEXT_TASK_START_LABEL}開始
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
                                {DEMO_NEXT_TASK_POINTS.map((point) => (
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

                        <div
                          className="ml-9 rounded-2xl border-2 border-saboru-heavy bg-saboru-cream p-3 shadow-[0_3px_0_#2b1e16]"
                          data-testid="recovery-check-ticket"
                        >
                          <p className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.08em] text-saboru-ink-muted">
                            <Camera size={13} />
                            自動画面読み取りチェック
                          </p>
                          <p className="mt-1 text-xs font-bold leading-relaxed text-saboru-ink">
                            {DEMO_RECOVERY_CHECK_LABEL}
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
                                {DEMO_NEXT_TASK_TITLE}
                                が見える画面に切り替わったら、またこっちから確認するね。
                              </p>
                            </div>
                          )}
                        </div>
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

function NextTaskStatusCard({
  taskTitle,
  startLabel,
  freeMinutes,
}: {
  taskTitle: string;
  startLabel: string;
  freeMinutes: number;
}) {
  return (
    <div
      className="px-3 pt-3 pb-2 bg-saboru-cream"
      data-testid="next-task-status"
      role="status"
      aria-live="polite"
    >
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
                {freeMinutes}
                <span className="ml-0.5 text-sm text-saboru-ink">分</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
