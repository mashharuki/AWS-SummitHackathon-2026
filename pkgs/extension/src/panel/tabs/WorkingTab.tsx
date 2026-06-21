/**
 * WorkingTab — ③タスク代行（作業中）
 *
 * 上部: MiniGantt（進行中タスクのスケジュール。8-17時/昼休み固定）
 * 下部: 「SABOROUがタスク実行中（LIVE）」ブラウザ操作プレビュー（スクレイピング演出）
 *       + ステップ進捗（文脈解析 → Webスクレイピング → MCPで成果物作成）
 *
 * 1タスクずつ順次進行。合間に別タスクは挟まない（設計判断 §3-4）。
 * モック(11.33.45)準拠。実行演出は擬似（実際の代行実行は将来機能）。
 */

import { useSaborou } from "@/panel/SaborouContext";
import { MiniGantt } from "@/panel/components/MiniGantt";
import { Badge, Card, EmptyState, SectionLabel } from "@/panel/components/ui";
import { getSchedule } from "@/panel/lib/agentClient";
import type { SaboriSchedule } from "@/panel/lib/types";
import { CheckCircle2, Globe, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const EXEC_STEPS = [
  {
    icon: CheckCircle2,
    title: "文脈を解析",
    sub: "Slack の依頼 + 締切 + Docs から条件を読み込み",
    state: "done" as const,
  },
  {
    icon: Loader2,
    title: "Web スクレイピング",
    sub: "必要な情報を収集中",
    state: "active" as const,
  },
  {
    icon: Sparkles,
    title: "MCP で成果物作成",
    sub: "スライド / フォームを生成",
    state: "pending" as const,
  },
];

export function WorkingTab() {
  const { jwt, tasks } = useSaborou();
  const [schedule, setSchedule] = useState<SaboriSchedule | null>(null);

  // 進行中（先頭の承認済みタスク）のスケジュールを取得。1タスクずつ。
  const activeTask = tasks[0] ?? null;

  useEffect(() => {
    if (!jwt || !activeTask) return;
    let cancelled = false;
    void getSchedule(activeTask.taskId, jwt).then((s) => {
      if (!cancelled) setSchedule(s);
    });
    return () => {
      cancelled = true;
    };
  }, [jwt, activeTask]);

  return (
    <div className="flex flex-col gap-3 px-3 py-3" data-testid="working-tab">
      {/* ガント */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>今日のスケジュール</SectionLabel>
          <span className="text-[9px] text-[#9ca3af]">8:00 – 17:00</span>
        </div>
        <MiniGantt schedule={schedule} />
      </Card>

      {/* 実行中プレビュー */}
      {activeTask ? (
        <Card accent="#2b1e16" className="bg-[#1f2937] text-white">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#10b981]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              LIVE
            </span>
            <span className="text-xs font-bold">SABOROU がタスク実行中</span>
          </div>
          <p className="text-[11px] text-white/70 mb-2 line-clamp-1">
            {activeTask.title}
          </p>

          {/* ブラウザ操作プレビュー（スクレイピング演出） */}
          <div className="rounded-lg bg-[#111827] border border-white/10 p-2 mb-3">
            <div className="flex items-center gap-1 mb-1.5">
              <Globe size={11} className="text-white/50" />
              <span className="text-[9px] text-white/50">
                ブラウザ操作プレビュー
              </span>
              <Badge tone="green" className="ml-auto">
                scraping
              </Badge>
            </div>
            {/* スキャンライン演出 */}
            <div className="relative h-2 rounded bg-white/10 overflow-hidden mb-1">
              <div
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#10b981] to-transparent"
                style={{ animation: "scanLine 1.6s linear infinite" }}
              />
            </div>
            <div className="relative h-2 rounded bg-white/10 overflow-hidden">
              <div
                className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-[#3b82f6] to-transparent"
                style={{ animation: "scanLine 2.1s linear infinite" }}
              />
            </div>
          </div>

          {/* 実行ステップ */}
          <div className="flex flex-col gap-2">
            {EXEC_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex items-start gap-2">
                  <Icon
                    size={14}
                    className={
                      step.state === "done"
                        ? "text-[#10b981] mt-0.5"
                        : step.state === "active"
                          ? "text-[#3b82f6] mt-0.5 animate-spin"
                          : "text-white/30 mt-0.5"
                    }
                  />
                  <div>
                    <p
                      className={
                        step.state === "pending"
                          ? "text-[11px] font-bold text-white/40"
                          : "text-[11px] font-bold text-white"
                      }
                    >
                      {step.title}
                    </p>
                    <p className="text-[9px] text-white/50">{step.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={<Sparkles size={32} />}
          title="実行中のタスクはありません"
          hint="依頼整理で承認すると、ここで SABOROU が代行します"
        />
      )}
    </div>
  );
}
