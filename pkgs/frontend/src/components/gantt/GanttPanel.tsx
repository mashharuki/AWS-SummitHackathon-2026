import { GanttChart } from "@/components/gantt/GanttChart";
import { useGanttSchedule } from "@/hooks/useGanttSchedule";
import { useToast } from "@/hooks/useToast";
import apiClient from "@/lib/apiClient";
import { blocksToPlannedSteps } from "@/lib/ganttEdit";
import { buildDummySchedule } from "@/lib/ganttLayout";
import type { SaboriSchedule, ScheduleBlock } from "@saboru/shared";
import { RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * GanttPanel — タスク詳細に埋め込むガント表示パネル
 *
 * - スケジュール取得（useGanttSchedule）
 * - ローディング表示
 * - 取得失敗 / 未生成時はダミースケジュールで常時ガントを表示（デモ映え優先・論点3合意）
 * - ガント下部に再計算ボタンを表示（盤面評価サマリは撤去）
 */
interface GanttPanelProps {
  taskId: string;
  /**
   * 判定の根拠件数。盤面評価サマリ撤去に伴い現在は未使用だが、
   * 呼び出し側の配線を壊さないよう prop は維持する（将来の指標表示用）。
   */
  reasoningCount?: number;
  className?: string;
}

export function GanttPanel({ taskId, className }: GanttPanelProps) {
  const { t } = useTranslation();
  const { schedule, isLoading, reload } = useGanttSchedule(taskId);
  const { showToast } = useToast();

  // 楽観更新用のローカル上書きスケジュール（編集確定→保存の間に即時反映）。
  // null のときはサーバ取得（schedule）をそのまま表示する。
  const [optimistic, setOptimistic] = useState<SaboriSchedule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 取得中はローディング、未取得/失敗ならダミーで常時表示（空にしない）。
  // 楽観更新があればそれを最優先で表示する。
  const base = schedule ?? buildDummySchedule(taskId);
  const effective = optimistic ?? base;

  // 実スケジュールが取れている（ダミーでない）ときのみ編集可能にする。
  const editable = schedule !== null;

  /**
   * 編集確定ハンドラ: 編集後ブロックから plannedSteps を再構成して保存する。
   * - 楽観更新: まずローカルに即時反映
   * - 成功: reload で最新スケジュール（さぼり時間サマリ含む）を再計算・再取得
   * - 失敗: ロールバック + エラートースト
   */
  const handleBlocksCommit = useCallback(
    async (blocks: ScheduleBlock[]) => {
      if (!schedule) return;
      // 楽観更新: 当日ビューの編集結果を全体スケジュールにマージ。
      // stepId 一致のブロックを差し替える（他日のブロックは保持）。
      const overrideMap = new Map(blocks.map((b) => [b.stepId, b]));
      const merged: SaboriSchedule = {
        ...schedule,
        blocks: schedule.blocks.map((b) => overrideMap.get(b.stepId) ?? b),
      };
      setOptimistic(merged);
      setIsSaving(true);

      // schedule.blocks を originalBlocks として渡し、移動していない work に anchorAt を付与しないようにする。
      // 移動済み（startAt が変化した）work のみ anchorAt が付与され、後ろ詰めから外れる。
      const plannedSteps = blocksToPlannedSteps(blocks, schedule.blocks);
      try {
        await apiClient.updatePlannedSteps(taskId, plannedSteps);
        // 保存成功: サーバで後ろ詰め再計算した最新を取り直す（さぼり時間も更新）。
        // reload 完了後、サーバ値で表示するため楽観上書きを解除する。
        setOptimistic(null);
        reload();
        showToast("スケジュールを更新しました", "success");
      } catch {
        // 失敗: ロールバック（サーバ取得値に戻す）+ エラー通知
        setOptimistic(null);
        showToast("更新に失敗しました。もう一度お試しください", "error");
      } finally {
        setIsSaving(false);
      }
    },
    [schedule, taskId, reload, showToast],
  );

  if (isLoading && !schedule) {
    return (
      <div
        className="card-brutal flex items-center justify-center"
        style={{ minHeight: 200 }}
      >
        <div
          className="w-6 h-6 border-2 border-saboru-orange border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label={t("common.loading")}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <GanttChart
        schedule={effective}
        editable={editable}
        onBlocksCommit={handleBlocksCommit}
      />
      {isSaving && (
        <p className="mt-1 text-[10px] text-saboru-ink-muted" role="status">
          保存中...
        </p>
      )}

      {/* 「サボり盤面評価」サマリは撤去。再計算ボタンのみ右寄せで残す
          （今のカレンダー状況でスケジュールを組み直す実用機能）。 */}
      <div className="mt-2 flex items-center justify-end">
        <button
          type="button"
          onClick={reload}
          disabled={isLoading}
          aria-label="スケジュールを再計算"
          title="今のカレンダー状況でスケジュールを組み直す"
          className="w-7 h-7 flex items-center justify-center rounded-md border-2 border-saboru-heavy text-saboru-ink hover:bg-saboru-line-soft disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw
            size={14}
            className={isLoading ? "animate-spin" : undefined}
            aria-hidden="true"
          />
        </button>
      </div>
      {!effective.calendarUsed && (
        <p className="mt-1 text-[10px] text-saboru-ink-muted">
          ※
          カレンダー未連携のためサンプル配置を表示中。連携すると予定を避けて再計算します。
        </p>
      )}
    </div>
  );
}
