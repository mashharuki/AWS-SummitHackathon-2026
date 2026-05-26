import { GanttChart } from "@/components/gantt/GanttChart";
import { useGanttSchedule } from "@/hooks/useGanttSchedule";
import { buildDummySchedule } from "@/lib/ganttLayout";
import { calcGanttGrade } from "@/lib/ganttScoringUtils";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * GanttPanel — タスク詳細に埋め込むガント表示パネル
 *
 * - スケジュール取得（useGanttSchedule）
 * - ローディング表示
 * - 取得失敗 / 未生成時はダミースケジュールで常時ガントを表示（デモ映え優先・論点3合意）
 * - ガント下部に「さぼり時間」サマリとガントグレードを表示
 */
interface GanttPanelProps {
  taskId: string;
  /** 判定の根拠件数（ガントグレード算出に使用） */
  reasoningCount?: number;
  className?: string;
}

export function GanttPanel({
  taskId,
  reasoningCount = 0,
  className,
}: GanttPanelProps) {
  const { t } = useTranslation();
  const { schedule, isLoading, reload } = useGanttSchedule(taskId);

  // 取得中はローディング、未取得/失敗ならダミーで常時表示（空にしない）
  const effective = schedule ?? buildDummySchedule(taskId);
  const grade = calcGanttGrade(effective.totalSaboruMinutes, reasoningCount);

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
      <GanttChart schedule={effective} />

      {/* ガント結果サマリ（さぼり時間 + ガントグレード） */}
      <div className="mt-2 flex items-center justify-between card-brutal px-3 py-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-saboru-ink-soft">
            確保したサボり時間
          </span>
          <span className="text-lg font-extrabold text-verdict-can">
            {effective.totalSaboruMinutes}
          </span>
          <span className="text-xs text-saboru-ink-soft">分</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-saboru-ink-muted">
            サボり盤面評価
          </span>
          <span
            className="text-base font-black px-2 py-0.5 rounded-md border-2 border-saboru-heavy"
            style={{ background: "#FEF0C7" }}
          >
            {grade.grade}
          </span>
          {/* 手動再計算: 今のカレンダー状況で組み直す（普段はキャッシュ表示） */}
          <button
            type="button"
            onClick={reload}
            disabled={isLoading}
            aria-label="スケジュールを再計算"
            title="今のカレンダー状況でスケジュールを組み直す"
            className="ml-1 w-7 h-7 flex items-center justify-center rounded-md border-2 border-saboru-heavy text-saboru-ink hover:bg-saboru-line-soft disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw
              size={14}
              className={isLoading ? "animate-spin" : undefined}
              aria-hidden="true"
            />
          </button>
        </div>
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
