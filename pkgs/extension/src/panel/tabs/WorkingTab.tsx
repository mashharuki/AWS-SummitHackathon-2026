/**
 * WorkingTab — ③タスク代行（作業中）
 *
 * 上部: MiniGantt（進行中タスクのスケジュール。8-17時/昼休み固定）
 * 下部: 「SABOROUがタスク実行中（LIVE）」ブラウザ操作プレビュー（スクレイピング演出）
 *       + ステップ進捗（タスク代行開始後にアニメーションで進行）
 */

import { useSaborou } from "@/panel/SaborouContext";
import { MiniGantt } from "@/panel/components/MiniGantt";
import { Badge, Card, EmptyState, SectionLabel } from "@/panel/components/ui";
import { getSchedule } from "@/panel/lib/agentClient";
import type { SaboriSchedule } from "@/panel/lib/types";
import { CheckCircle2, Globe, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type StepState = "done" | "active" | "pending";

const STEP_DEFS = [
  {
    title: "旅程の情報を収集",
    sub: "Slack の依頼 + 期日 + 参加者情報を読み込み",
  },
  {
    title: "新幹線・ホテルの空き確認",
    sub: "JR・宿泊施設の空き状況を収集中",
  },
  {
    title: "社内共有スライドを生成",
    sub: "MCP で成果物を作成",
  },
] as const;

export function WorkingTab() {
  const { jwt, tasks } = useSaborou();
  const [schedule, setSchedule] = useState<SaboriSchedule | null>(null);
  const [stepStates, setStepStates] = useState<StepState[]>([
    "active",
    "pending",
    "pending",
  ]);

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

  // タスク代行開始時にステップアニメーションを再生
  useEffect(() => {
    if (!activeTask) return;
    setStepStates(["active", "pending", "pending"]);
    const t1 = setTimeout(
      () => setStepStates(["done", "active", "pending"]),
      2000,
    );
    const t2 = setTimeout(
      () => setStepStates(["done", "done", "active"]),
      5000,
    );
    const t3 = setTimeout(
      () => setStepStates(["done", "done", "done"]),
      9000,
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [activeTask?.taskId]);

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

          {/* 実行ステップ（動的アニメーション） */}
          <div className="flex flex-col gap-2">
            {STEP_DEFS.map((def, idx) => {
              const state = stepStates[idx] ?? "pending";
              const IconEl =
                state === "done"
                  ? CheckCircle2
                  : state === "active"
                    ? Loader2
                    : Sparkles;
              return (
                <div key={def.title} className="flex items-start gap-2">
                  <IconEl
                    size={14}
                    className={
                      state === "done"
                        ? "text-[#10b981] mt-0.5"
                        : state === "active"
                          ? "text-[#3b82f6] mt-0.5 animate-spin"
                          : "text-white/30 mt-0.5"
                    }
                  />
                  <div>
                    <p
                      className={
                        state === "pending"
                          ? "text-[11px] font-bold text-white/40"
                          : "text-[11px] font-bold text-white"
                      }
                    >
                      {def.title}
                    </p>
                    <p className="text-[9px] text-white/50">{def.sub}</p>
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
