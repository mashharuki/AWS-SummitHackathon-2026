/**
 * WorkingTab — ③タスク代行（作業中）
 *
 * 上部: MiniGantt（進行中タスクのスケジュール）
 * 下部: SABOROUがタスク実行中（LIVE）プレビュー
 *       + ステップ進捗（タスク種別に応じて動的に切り替え）
 */

import { useSaborou } from "@/panel/SaborouContext";
import { MiniGantt } from "@/panel/components/MiniGantt";
import { Badge, Card, EmptyState, SectionLabel } from "@/panel/components/ui";
import { getSchedule } from "@/panel/lib/agentClient";
import type { SaboriSchedule } from "@/panel/lib/types";
import { CheckCircle2, Globe, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type StepState = "done" | "active" | "pending";

// ---------------------------------------------------------------------------
// タスク種別からステップ定義を生成
// ---------------------------------------------------------------------------

function getStepDefs(
  taskTitle: string,
): readonly { title: string; sub: string }[] {
  const text = taskTitle.toLowerCase();
  const isTravel = /旅程|出張|旅行|新幹線|ホテル|宿泊|交通|航空/.test(text);
  const isSlides = /スライド|資料|プレゼン|presentation|slide|docs/.test(text);

  if (isTravel && isSlides) {
    return [
      { title: "旅程の情報を収集", sub: "期日・参加者・経路を読み込み" },
      {
        title: "新幹線・ホテルの空き確認",
        sub: "JR・宿泊施設の空き状況を収集中",
      },
      { title: "社内共有スライドを生成", sub: "MCP で成果物を作成" },
    ];
  }
  if (isTravel) {
    return [
      { title: "旅程の情報を収集", sub: "期日・参加者・経路を読み込み" },
      {
        title: "新幹線・ホテルの空き確認",
        sub: "JR・宿泊施設の空き状況を収集中",
      },
      { title: "旅程表を作成", sub: "MCP でドキュメントを生成" },
    ];
  }
  if (isSlides) {
    return [
      { title: "タスク情報を収集", sub: "Slack の依頼内容から要件を抽出" },
      { title: "コンテンツを生成", sub: "Claude が構成・本文を作成中" },
      { title: "スライドを作成", sub: "MCP で Docs に書き出し" },
    ];
  }
  return [
    {
      title: "タスクを分析",
      sub: "Slack の依頼 + 期日から条件を読み込み",
    },
    { title: "必要な情報を収集", sub: "Web スクレイピングで情報収集中" },
    { title: "成果物を作成", sub: "MCP でファイルを生成" },
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkingTab() {
  const { jwt, tasks, tasksLoading, refreshTasks } = useSaborou();
  const [schedule, setSchedule] = useState<SaboriSchedule | null>(null);
  const [stepStates, setStepStates] = useState<StepState[]>([
    "active",
    "pending",
    "pending",
  ]);

  const activeTask = tasks[0] ?? null;
  const stepDefs = activeTask ? getStepDefs(activeTask.title) : [];

  // タブがマウントされたときに最新タスクを取得する
  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

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
  }, [activeTask]);

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="working-tab-loading">
        <div className="w-6 h-6 rounded-full border-2 border-[#f97316] border-t-transparent animate-spin" />
      </div>
    );
  }

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

          {/* 実行ステップ（タスク種別に応じた動的ステップ） */}
          <div className="flex flex-col gap-2">
            {stepDefs.map((def, idx) => {
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
