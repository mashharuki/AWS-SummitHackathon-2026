/**
 * WorkingTab — ③タスク代行（作業中）
 *
 * PM機能追加後:
 * 上部: PM分析 / サブタスク承認フロー（GoalAnalysis がある場合）
 * 下部: SABOROUがタスク実行中（LIVE）プレビュー（フォールバック）
 */

import { useSaborou } from "@/panel/SaborouContext";
import { SubtaskCard } from "@/panel/components/SubtaskCard";
import { Badge, Card, EmptyState, SectionLabel } from "@/panel/components/ui";
import { decomposeTask, updateSubtaskStatus } from "@/panel/lib/agentClient";
import type { SubTask } from "@/panel/lib/types";
import { CheckCircle2, Globe, Loader2, Sparkles, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// フォールバック: タスク種別からステップ定義を生成（GoalAnalysisがない場合）
// ---------------------------------------------------------------------------

type StepState = "done" | "active" | "pending";

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
    { title: "タスクを分析", sub: "Slack の依頼 + 期日から条件を読み込み" },
    { title: "必要な情報を収集", sub: "Web スクレイピングで情報収集中" },
    { title: "成果物を作成", sub: "MCP でファイルを生成" },
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkingTab() {
  const {
    jwt,
    tasks,
    tasksLoading,
    tasksError,
    refreshTasks,
    goalAnalysis,
    setGoalAnalysis,
    delegatedTaskId,
  } = useSaborou();
  const [decomposing, setDecomposing] = useState(false);
  const [decomposeError, setDecomposeError] = useState(false);
  const [stepStates, setStepStates] = useState<StepState[]>([
    "active",
    "pending",
    "pending",
  ]);
  const decomposedTaskIdRef = useRef<string | null>(null);

  const activeTask =
    (delegatedTaskId
      ? tasks.find((t) => t.taskId === delegatedTaskId)
      : tasks[0]) ?? null;
  const stepDefs = activeTask ? getStepDefs(activeTask.title) : [];

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  // PM分解: activeTaskが変わったときにGoalAnalysisを取得/生成
  useEffect(() => {
    if (!jwt || !activeTask) {
      setGoalAnalysis(null);
      return;
    }
    if (decomposedTaskIdRef.current === activeTask.taskId) return;
    decomposedTaskIdRef.current = activeTask.taskId;
    setDecomposing(true);
    setDecomposeError(false);
    setGoalAnalysis(null);

    const taskId = activeTask.taskId;
    const runDecompose = (): Promise<void> =>
      decomposeTask(taskId, jwt).then((ga) => setGoalAnalysis(ga));

    // Retry once after 3s to handle API Gateway / Bedrock cold-start timeouts.
    runDecompose()
      .catch(() =>
        new Promise<void>((resolve) => setTimeout(resolve, 3000)).then(
          runDecompose,
        ),
      )
      .catch((err) => {
        console.warn("[WorkingTab] decomposeTask failed after retry:", err);
        setDecomposeError(true);
        // decomposedTaskIdRef をリセットしてリトライできるようにする
        decomposedTaskIdRef.current = null;
      })
      .finally(() => setDecomposing(false));
  }, [jwt, activeTask, setGoalAnalysis]);

  // フォールバックアニメーション（GoalAnalysisがない場合）
  useEffect(() => {
    if (!activeTask || goalAnalysis) return;
    setStepStates(["active", "pending", "pending"]);
    const t1 = setTimeout(
      () => setStepStates(["done", "active", "pending"]),
      2000,
    );
    const t2 = setTimeout(
      () => setStepStates(["done", "done", "active"]),
      5000,
    );
    const t3 = setTimeout(() => setStepStates(["done", "done", "done"]), 9000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [activeTask, goalAnalysis]);

  // サブタスク承認ハンドラ
  const handleApproveSubtask = useCallback(
    async (subtask: SubTask) => {
      if (!jwt || !activeTask || !goalAnalysis) return;
      setGoalAnalysis((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          subtasks: prev.subtasks.map((st) =>
            st.id === subtask.id ? { ...st, status: "executing" } : st,
          ),
        };
      });
      try {
        await updateSubtaskStatus(
          activeTask.taskId,
          subtask.id,
          "approved",
          jwt,
        );
        // 少し待ってからdoneにする（実行演出）
        setTimeout(() => {
          setGoalAnalysis((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              subtasks: prev.subtasks.map((st) =>
                st.id === subtask.id ? { ...st, status: "done" } : st,
              ),
            };
          });
        }, 2000);
      } catch (err) {
        console.warn("[WorkingTab] updateSubtaskStatus failed:", err);
        setGoalAnalysis((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            subtasks: prev.subtasks.map((st) =>
              st.id === subtask.id ? { ...st, status: "pending" } : st,
            ),
          };
        });
      }
    },
    [jwt, activeTask, goalAnalysis, setGoalAnalysis],
  );

  const handleSkipSubtask = useCallback(
    async (subtask: SubTask) => {
      if (!jwt || !activeTask) return;
      setGoalAnalysis((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          subtasks: prev.subtasks.map((st) =>
            st.id === subtask.id ? { ...st, status: "skipped" } : st,
          ),
        };
      });
      await updateSubtaskStatus(
        activeTask.taskId,
        subtask.id,
        "skipped",
        jwt,
      ).catch(() => {});
    },
    [jwt, activeTask, setGoalAnalysis],
  );

  const isGoalAchieved =
    goalAnalysis?.subtasks.every(
      (st) => st.status === "done" || st.status === "skipped",
    ) ?? false;

  // アクティブなサブタスク（次に承認が必要なもの）
  const activeSubtaskIndex =
    goalAnalysis?.subtasks.findIndex(
      (st) => st.status === "pending" || st.status === "executing",
    ) ?? -1;

  if (tasksLoading) {
    return (
      <div
        className="flex items-center justify-center py-16"
        data-testid="working-tab-loading"
      >
        <div className="w-6 h-6 rounded-full border-2 border-[#f97316] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-3" data-testid="working-tab">
      {/* PM分析ローディング */}
      {decomposing && activeTask && (
        <Card>
          <div className="flex items-center gap-2 py-2">
            <Loader2 size={14} className="text-[#f97316] animate-spin" />
            <div>
              <p className="text-xs font-bold text-[#111827]">PM分析中...</p>
              <p className="text-[10px] text-[#6b7280]">
                PMBOK WBS手法でゴールを分解しています
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* PM分析エラー */}
      {decomposeError && !decomposing && activeTask && !goalAnalysis && (
        <Card>
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-bold text-[#dc2626]">
                PM分析に失敗しました
              </p>
              <p className="text-[10px] text-[#6b7280]">
                Bedrockへの接続を確認してください
              </p>
            </div>
            <button
              type="button"
              className="text-[10px] font-bold text-[#f97316] border border-[#f97316] rounded-lg px-2 py-1 active:scale-95"
              onClick={() => {
                decomposedTaskIdRef.current = null;
                setDecomposeError(false);
              }}
            >
              リトライ
            </button>
          </div>
        </Card>
      )}

      {/* ゴール達成 */}
      {isGoalAchieved && goalAnalysis && (
        <Card accent="#10b981" className="bg-[#d1fae5]">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={18} className="text-[#065f46]" />
            <span className="font-bold text-sm text-[#065f46]">
              ゴール達成！
            </span>
          </div>
          <p className="text-xs text-[#065f46] font-medium mb-1">
            {goalAnalysis.goalSummary}
          </p>
          <div className="mt-2 pt-2 border-t border-[#a7f3d0]">
            <p className="text-[10px] text-[#065f46] font-semibold mb-0.5">
              今日の余白の過ごし方
            </p>
            <p className="text-xs text-[#065f46] leading-relaxed">
              {goalAnalysis.freeTimeSuggestion}
            </p>
            {goalAnalysis.freeTimeMinutes > 0 && (
              <p className="text-[10px] text-[#10b981] mt-1">
                余白時間: {goalAnalysis.freeTimeMinutes}分
              </p>
            )}
          </div>
        </Card>
      )}

      {/* PM WBS サブタスクフロー */}
      {goalAnalysis && !isGoalAchieved && activeTask && (
        <Card>
          {/* ゴール概要 */}
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <SectionLabel>PMがゴールを分解</SectionLabel>
              <Badge tone="orange">WBS</Badge>
            </div>
            <p className="text-xs text-[#374151] font-medium">
              {goalAnalysis.goalSummary}
            </p>
            <p className="text-[10px] text-[#9ca3af] mt-0.5">
              成果物: {goalAnalysis.deliverable}
            </p>
          </div>

          {/* サブタスクリスト */}
          <div className="flex flex-col gap-2">
            {goalAnalysis.subtasks.map((subtask, idx) => (
              <SubtaskCard
                key={subtask.id}
                subtask={subtask}
                isActive={idx === activeSubtaskIndex}
                onApprove={() => void handleApproveSubtask(subtask)}
                onSkip={() => void handleSkipSubtask(subtask)}
              />
            ))}
          </div>

          {/* 進捗バー */}
          <div className="mt-3">
            <div className="flex justify-between text-[9px] text-[#9ca3af] mb-1">
              <span>進捗</span>
              <span>
                {
                  goalAnalysis.subtasks.filter(
                    (st) => st.status === "done" || st.status === "skipped",
                  ).length
                }
                /{goalAnalysis.subtasks.length}
              </span>
            </div>
            <div className="h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#f97316] rounded-full transition-all duration-500"
                style={{
                  width: `${
                    (goalAnalysis.subtasks.filter(
                      (st) => st.status === "done" || st.status === "skipped",
                    ).length /
                      goalAnalysis.subtasks.length) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* フォールバック: GoalAnalysisがない場合のLIVEプレビュー */}
      {!goalAnalysis && !decomposing && activeTask && (
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
      )}

      {/* タスクなし */}
      {!activeTask &&
        !tasksLoading &&
        (tasksError ? (
          <EmptyState
            icon={<Sparkles size={32} />}
            title="データの取得に失敗しました"
            hint="APIに接続できませんでした。再度ログインするか管理者に連絡してください"
          />
        ) : (
          <EmptyState
            icon={<Sparkles size={32} />}
            title="実行中のタスクはありません"
            hint="依頼整理で承認すると、ここで SABOROU が代行します"
          />
        ))}
    </div>
  );
}
