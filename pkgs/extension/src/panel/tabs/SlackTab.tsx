/**
 * SlackTab — ④⑤⑥ 余白（サボれる理由 / 動いてるフリ / 使い道提案）
 *
 * - サボローチャット: proposal の chatMessage / reasoning を「サボれる理由」として提示
 * - 動いてるフリ: ProgressReportSheet（report API → DOM 送信）
 * - 使い道提案: Netflix / 散歩 などをモック提示
 *
 * モック(11.33.51 / 11.34.01 / 11.34.10)準拠。
 */

import { cn } from "@/lib/utils";
import { useSaborou } from "@/panel/SaborouContext";
import { ProgressReportSheet } from "@/panel/components/ProgressReportSheet";
import { Button, Card, EmptyState } from "@/panel/components/ui";
import { getProposal } from "@/panel/lib/agentClient";
import { getSuggestions } from "@/panel/lib/freeSuggestions";
import type { Proposal } from "@/panel/lib/types";
import { Coffee, ExternalLink, FileText, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

export function SlackTab() {
  const { jwt, tasks, representativeProposal, scheduleSaboruMinutes, chatMessages } =
    useSaborou();
  const [proposal, setProposal] = useState<Proposal | null>(
    representativeProposal,
  );
  const [loading, setLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showLeisure, setShowLeisure] = useState(false);

  const activeTask = tasks[0] ?? null;

  // 代表 proposal が無ければ先頭タスクの proposal を取得
  useEffect(() => {
    if (proposal || !jwt || !activeTask) return;
    setLoading(true);
    void getProposal(activeTask.taskId, jwt)
      .then((p) => setProposal(p))
      .finally(() => setLoading(false));
  }, [jwt, activeTask, proposal]);

  const reasons = proposal?.reasoning ?? [];
  const chatMessage =
    proposal?.chatMessage ??
    "議事録はもう確認済みで、文章修正と返信案作成も完了しています。次の固定予定は16:15のデモ確認MTGなので、今から休んでも後続タスクには影響しません。";

  return (
    <div className="flex flex-col h-full" data-testid="slack-tab">
      {/* チャットエリア（サボれる理由） */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="text-[#f97316] animate-spin" />
          </div>
        ) : (
          <>
            {/* SABOROU の一言 */}
            <div className="flex gap-2">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#f97316] border-2 border-[#2b1e16] shadow-[0_2px_0_#2b1e16] flex items-center justify-center text-white font-black text-[10px]">
                サ
              </div>
              <div className="flex-1 p-2.5 rounded-xl rounded-tl-sm bg-white border-2 border-[#2b1e16] shadow-[0_3px_0_#2b1e16]">
                <p className="text-[10px] font-bold text-[#9ca3af] mb-1">
                  SABOROU チャット
                </p>
                <p className="text-sm text-[#1f2937] leading-relaxed">
                  {chatMessage}
                </p>
              </div>
            </div>

            {/* サボれる理由（reasoning） */}
            {reasons.length > 0 && (
              <Card accent="#10b981">
                <p className="text-[10px] font-bold text-[#059669] mb-1.5">
                  サボれる根拠
                </p>
                <ul className="flex flex-col gap-1">
                  {reasons.map((r) => (
                    <li
                      key={r}
                      className="flex items-start gap-1.5 text-xs text-[#1f2937]"
                    >
                      <span className="text-[#10b981] mt-0.5">✓</span>
                      <span className="leading-relaxed">{r}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {!activeTask &&
              reasons.length === 0 &&
              chatMessages.length === 0 && (
                <EmptyState
                  icon={<Coffee size={32} />}
                  title="まだ余白の提案はありません"
                  hint="下のチャットで質問するか、タスクを承認するとサボれる理由を提示します"
                />
              )}

            {/* ユーザーとのチャット履歴（下部の共通チャットバーから投稿される） */}
            {chatMessages.map((m) =>
              m.role === "user" ? (
                <div
                  key={m.id}
                  className="flex justify-end"
                  data-testid="chat-user"
                >
                  <div className="max-w-[80%] p-2.5 rounded-xl rounded-tr-sm bg-[#f97316] text-white border-2 border-[#2b1e16] shadow-[0_3px_0_#2b1e16]">
                    <p className="text-sm leading-relaxed">{m.text}</p>
                  </div>
                </div>
              ) : (
                <div
                  key={m.id}
                  className="flex gap-2"
                  data-testid="chat-saborou"
                >
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#f97316] border-2 border-[#2b1e16] shadow-[0_2px_0_#2b1e16] flex items-center justify-center text-white font-black text-[10px]">
                    サ
                  </div>
                  <div className="flex-1 p-2.5 rounded-xl rounded-tl-sm bg-white border-2 border-[#2b1e16] shadow-[0_3px_0_#2b1e16]">
                    <p className="text-sm text-[#1f2937] leading-relaxed">
                      {m.text}
                    </p>
                  </div>
                </div>
              ),
            )}
          </>
        )}
      </div>

      {/* 下部アクション */}
      <div className="px-3 py-2.5 border-t-2 border-[#f3f4f6] bg-[#fffaf5] flex flex-col gap-2">
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

      {/* 使い道提案ポップアップ（モック） */}
      {showLeisure && (
        <LeisureSuggestion
          freeMinutes={scheduleSaboruMinutes ?? 60}
          onClose={() => setShowLeisure(false)}
        />
      )}
    </div>
  );
}

/** 余白の使い道提案（Amazon Prime / 散歩 など。モック） */
function LeisureSuggestion({ onClose }: { onClose: () => void }) {
  const suggestions = [
    {
      icon: Film,
      title: "Amazon Prime の続きを見る",
      sub: "先週見ていたアニメの続き、残り 15 分で1話終わります。",
      cta: "Amazon Prime を開く",
      color: "#00A8E0",
    },
    {
      icon: Footprints,
      title: "10 分だけ散歩する",
      sub: "天気は晴れ。少し歩くと午後の集中力が戻ります。",
      cta: "あとで",
      color: "#10b981",
    },
  ];
}: {
  freeMinutes: number;
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
      <div className="relative w-full bg-[#1f2937] rounded-t-2xl border-t-2 border-x-2 border-[#2b1e16] p-4 animate-[slideUp_0.18s_ease-out]">
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
                <p className="text-[9px] text-[#f97316] font-bold mt-0.5">
                  {s.service}
                </p>
              </div>
              <ExternalLink
                size={13}
                className="text-white/30 flex-shrink-0 ml-2"
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
