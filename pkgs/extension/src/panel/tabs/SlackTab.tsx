/**
 * SlackTab — ④⑤⑥ 余白（サボローチャット / 動いてるフリ / 使い道提案）
 *
 * - サボローチャット: デモ用の固定文面を提示
 * - 動いてるフリ: ProgressReportSheet（report API → DOM 送信）
 * - 使い道提案: Amazon サービスへの余白の使い道を提示
 *
 * モック(11.33.51 / 11.34.01 / 11.34.10)準拠。
 */

import { useSaborou } from "@/panel/SaborouContext";
import { ProgressReportSheet } from "@/panel/components/ProgressReportSheet";
import { Button } from "@/panel/components/ui";
import { getSuggestions } from "@/panel/lib/freeSuggestions";
import { Clock, Coffee, ExternalLink, FileText, X } from "lucide-react";
import { useState } from "react";

const DEMO_COMPLETED_TASK_TITLE = "ラスベガスの計画書タスク";
const DEMO_NEXT_TASK_TITLE = "AIエージェント改善定例会";
const DEMO_NEXT_TASK_START_LABEL = "19:30";
const DEMO_NEXT_TASK_REMINDER_LABEL = "19:20";
const DEMO_FREE_MINUTES = 40;

const DEMO_MARGIN_CHAT_MESSAGE =
  `よく頑張ったよ、ゆーたろ!${DEMO_COMPLETED_TASK_TITLE}、終了！ここは全力でサボろう。${DEMO_NEXT_TASK_REMINDER_LABEL}くらいから、またリマインドするね。`;

export function SlackTab() {
  const { tasks, scheduleSaboruMinutes, chatMessages, goalAnalysis } =
    useSaborou();
  const [showReport, setShowReport] = useState(false);
  const [showLeisure, setShowLeisure] = useState(false);

  const activeTask = tasks[0] ?? null;

  const freeMinutes =
    goalAnalysis?.freeTimeMinutes ?? scheduleSaboruMinutes ?? DEMO_FREE_MINUTES;

  return (
    <div className="flex flex-col h-full" data-testid="slack-tab">
      <NextTaskStatusCard
        taskTitle={DEMO_NEXT_TASK_TITLE}
        startLabel={DEMO_NEXT_TASK_START_LABEL}
        freeMinutes={DEMO_FREE_MINUTES}
      />

      {/* チャットエリア */}
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

        {/* ユーザーとのチャット履歴（下部の共通チャットバーから投稿される） */}
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
              className="flex gap-2"
              data-testid="chat-saborou"
            >
              <div className="shrink-0 w-7 h-7 rounded-lg bg-saboru-orange border-2 border-saboru-heavy shadow-[0_2px_0_#2b1e16] flex items-center justify-center text-white font-black text-[10px]">
                サ
              </div>
              <div className="flex-1 p-2.5 rounded-xl rounded-tl-sm bg-white border-2 border-saboru-heavy shadow-[0_3px_0_#2b1e16]">
                <p className="text-sm text-saboru-ink leading-relaxed">
                  {m.text}
                </p>
              </div>
            </div>
          ),
        )}
      </div>

      {/* 下部アクション */}
      <div className="px-3 py-2.5 border-t-2 border-saboru-line bg-saboru-cream flex flex-col gap-2">
        <Button
          variant="outline"
          className="w-full"
          disabled={!activeTask}
          onClick={() => setShowReport(true)}
          data-testid="open-report"
        >
          <FileText size={14} />
          自然な進捗報告を作成
        </Button>
        <Button
          variant="primary"
          className="w-full"
          onClick={() => setShowLeisure(true)}
          data-testid="open-leisure"
        >
          <Coffee size={14} />
          余白の使い道を提案してもらう
        </Button>
      </div>

      {/* 進捗報告ポップアップ */}
      {showReport && activeTask && (
        <ProgressReportSheet
          task={activeTask}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* 使い道提案ポップアップ */}
      {showLeisure && (
        <LeisureSuggestion
          freeMinutes={freeMinutes}
          aiSuggestion={goalAnalysis?.freeTimeSuggestion}
          onClose={() => setShowLeisure(false)}
        />
      )}
    </div>
  );
}

/** サボローチャットを開いた瞬間に、次の復帰タイミングを一目で見せるカード */
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

/** 余白の使い道提案（AI提案 + freeSuggestionsフォールバック） */
function LeisureSuggestion({
  freeMinutes,
  aiSuggestion,
  onClose,
}: {
  freeMinutes: number;
  aiSuggestion?: string;
  onClose: () => void;
}) {
  const suggestions = getSuggestions(freeMinutes);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      data-testid="leisure-popup"
    >
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full bg-saboru-ink rounded-t-2xl border-t-2 border-x-2 border-saboru-heavy p-4 animate-[slideUp_0.18s_ease-out]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">生まれた余白の使い道</p>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/50 hover:text-white"
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {/* AIによるパーソナライズ提案（Slack文脈から推測） */}
          {aiSuggestion && (
            <div className="p-3 rounded-xl bg-saboru-orange/20 border border-saboru-orange/40">
              <p className="text-[9px] font-bold text-saboru-orange mb-1">AIからのおすすめ</p>
              <p className="text-sm text-white leading-relaxed">{aiSuggestion}</p>
            </div>
          )}
          {suggestions.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl bg-[#111827] border border-white/10 hover:bg-white/5 transition-colors"
            >
              <div>
                <p className="text-sm font-bold text-white">{s.label}</p>
                <p className="text-[11px] text-white/60 mt-0.5">
                  {s.description}
                </p>
                <p className="text-[9px] text-saboru-orange font-bold mt-0.5">
                  {s.service}
                </p>
              </div>
              <ExternalLink
                size={13}
                className="text-white/30 shrink-0 ml-2"
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
