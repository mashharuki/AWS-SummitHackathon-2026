import {
  BAND_META,
  buildRows,
  buildTimeTicks,
  durationToWidthPx,
  filterScheduleByDay,
  isSameLocalDay,
  timeToPx,
  viewWidthPx,
} from "@/lib/ganttLayout";
import { cn } from "@/lib/utils";
import type { BandType, SaboriSchedule } from "@saboru/shared";
import { useEffect, useMemo, useState } from "react";

/**
 * GanttChart — 3バンドガントチャート（SABOROU のコアUI）
 *
 * タスクを作業ステップに分解し、Google Calendar の予定を避けて配置した
 * スケジュールを時間軸ガントで表示する。
 * - 横軸: 時間（15〜30分グリッド）。NOWライン（青点線）・締切ライン（赤）
 * - 縦軸: 作業ステップ行。最上段は「さぼろう」帯
 * - バンド色: 緑=さぼろう / 白枠=作業 / 黄=意思決定
 *
 * PC: 横スクロール可能なフル幅。スマホ: 横スクロールで読める最小設計。
 */
interface GanttChartProps {
  schedule: SaboriSchedule;
  /** 現在時刻（省略時は実時間。NOWライン用） */
  now?: Date;
  className?: string;
  /** 1時間あたりの px（PC=120 / スマホは呼び出し側で調整可） */
  pxPerHour?: number;
}

const LABEL_COL_PX = 116;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 28;

export function GanttChart({
  schedule,
  now,
  className,
  pxPerHour = 120,
}: GanttChartProps) {
  // 表示対象の日（1日単位）。デフォルトは現在日。ただしスケジュール期間外なら
  // 期間の端（初日／最終日）にクランプする（期間が過ぎた／未来でも空表示にしない）。
  // 締切が翌日以降のタスクでも、まずは「今日やる分」だけを見せる。
  const [viewDate, setViewDate] = useState<Date>(() => {
    const base = now ?? new Date();
    const startMs = new Date(schedule.viewStartAt).getTime();
    const endMs = new Date(schedule.viewEndAt).getTime();
    if (base.getTime() < startMs) return new Date(startMs);
    if (base.getTime() > endMs) return new Date(endMs);
    return base;
  });

  // NOWライン位置をリアルタイム更新（now 未指定時のみ）
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (now) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [now]);

  // 現在時刻。now prop があれば固定、無ければ tick 連動で再評価する。
  // useMemo の依存に毎回新しい Date を入れないため安定参照にする。
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick で実時間を再評価する意図
  const nowDate = useMemo(() => now ?? new Date(), [now, tick]);

  // スケジュールを「表示対象日の1日分」に絞り込む（行数・横幅を当日に限定）
  const view = useMemo(
    () => filterScheduleByDay(schedule, viewDate, nowDate),
    [schedule, viewDate, nowDate],
  );

  // 日付ナビの可否: スケジュール全体の期間（viewStartAt〜 deadline/viewEndAt）が
  // 複数日にまたがる場合のみ前後移動を許可する。
  const fullStart = new Date(schedule.viewStartAt);
  const fullEndIso = schedule.deadline ?? schedule.viewEndAt;
  const fullEnd = new Date(fullEndIso);
  const canPrev = !isSameLocalDay(viewDate, fullStart) && viewDate > fullStart;
  const canNext = !isSameLocalDay(viewDate, fullEnd) && viewDate < fullEnd;
  const isMultiDay = !isSameLocalDay(fullStart, fullEnd);

  const shiftDay = (delta: number) => {
    setViewDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  };

  const viewStartMs = new Date(view.viewStartAt).getTime();
  const rows = buildRows(view);
  const ticks = buildTimeTicks(view.viewStartAt, view.viewEndAt, pxPerHour);
  const totalWidth = viewWidthPx(view.viewStartAt, view.viewEndAt, pxPerHour);

  const nowMs = nowDate.getTime();
  const viewEndMs = new Date(view.viewEndAt).getTime();
  const nowInRange = nowMs >= viewStartMs && nowMs <= viewEndMs;
  const nowLeftPx = timeToPx(nowDate.toISOString(), viewStartMs, pxPerHour);

  const deadlineInRange =
    view.deadline !== null &&
    new Date(view.deadline).getTime() >= viewStartMs &&
    new Date(view.deadline).getTime() <= viewEndMs;
  const deadlineLeftPx = view.deadline
    ? timeToPx(view.deadline, viewStartMs, pxPerHour)
    : 0;

  const gridHeight = rows.length * ROW_HEIGHT;

  return (
    <div className={cn("card-brutal overflow-hidden", className)}>
      {/* ヘッダー: 日付（+複数日なら前後ナビ）+ 凡例 */}
      <div className="flex items-center justify-between px-3 py-2 border-b-[3px] border-saboru-heavy">
        <div className="flex items-center gap-1.5">
          {isMultiDay && (
            <button
              type="button"
              onClick={() => shiftDay(-1)}
              disabled={!canPrev}
              aria-label="前日"
              className="w-6 h-6 flex items-center justify-center rounded-md border-2 border-saboru-heavy text-saboru-ink text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-saboru-line-soft"
            >
              ‹
            </button>
          )}
          <span className="font-extrabold text-saboru-ink text-sm whitespace-nowrap">
            {formatDateHeader(view.viewStartAt)}
          </span>
          {isMultiDay && (
            <button
              type="button"
              onClick={() => shiftDay(1)}
              disabled={!canNext}
              aria-label="翌日"
              className="w-6 h-6 flex items-center justify-center rounded-md border-2 border-saboru-heavy text-saboru-ink text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-saboru-line-soft"
            >
              ›
            </button>
          )}
        </div>
        <div className="flex items-center gap-2.5 text-[11px]">
          <Legend bandType="saboru" />
          <Legend bandType="work" />
          <Legend bandType="decision" />
          <Legend bandType="busy" />
        </div>
      </div>

      {/* 本体: 横スクロール領域（左ラベル列は sticky 固定） */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: LABEL_COL_PX + totalWidth }}>
          {/* 時間軸ヘッダー */}
          <div className="flex" style={{ height: HEADER_HEIGHT }}>
            {/* 左ラベルセル（sticky 固定・スクロールしても左に残る） */}
            <div
              className="shrink-0 sticky left-0 z-20 border-r-[3px] border-saboru-heavy bg-saboru-line-soft"
              style={{ width: LABEL_COL_PX }}
            />
            <div
              className="relative bg-saboru-line-soft"
              style={{ width: totalWidth }}
            >
              {ticks.map((t) => (
                <span
                  key={t.iso}
                  className="absolute top-1 text-[10px] text-saboru-ink-muted -translate-x-1/2"
                  style={{ left: t.leftPx }}
                >
                  {t.label}
                </span>
              ))}
            </div>
          </div>

          {/* 行領域: 各行を「sticky ラベルセル + タイムラインセル」の横並びで構成 */}
          <div className="relative">
            {/* タイムライン背景（グリッド線 + NOW/締切ライン）— ラベル列幅ぶん右にオフセット */}
            <div
              className="absolute top-0 pointer-events-none"
              style={{
                left: LABEL_COL_PX,
                width: totalWidth,
                height: gridHeight,
              }}
            >
              {/* 縦グリッド線 */}
              {ticks.map((t) => (
                <div
                  key={t.iso}
                  className="absolute top-0 bottom-0 w-px bg-saboru-line"
                  style={{ left: t.leftPx }}
                />
              ))}
              {/* NOWライン（青点線 + チップ） */}
              {nowInRange && (
                <div
                  className="absolute top-0 z-10"
                  style={{ left: nowLeftPx, height: gridHeight }}
                  data-testid="gantt-now-line"
                >
                  <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-[#2E90FA]" />
                  <div className="absolute -top-[22px] -translate-x-1/2 bg-[#2E90FA] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    {formatNowChip(nowDate)}
                  </div>
                </div>
              )}
              {/* 締切ライン（赤実線） */}
              {deadlineInRange && (
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-[#EF4444] z-10"
                  style={{ left: deadlineLeftPx }}
                  data-testid="gantt-deadline-line"
                />
              )}
            </div>

            {/* 各行: sticky ラベル + バンド配置領域 */}
            {rows.map((row) => (
              <div
                key={`row-${row.stepLabel}-${row.blocks[0]?.stepId}`}
                className="flex border-b border-saboru-line"
                style={{ height: ROW_HEIGHT }}
              >
                {/* 左ラベル（sticky 固定） */}
                <div
                  className="shrink-0 sticky left-0 z-20 flex items-center px-2 text-[11px] font-bold text-saboru-ink border-r-[3px] border-saboru-heavy bg-saboru-paper"
                  style={{ width: LABEL_COL_PX }}
                >
                  <span className="line-clamp-2 leading-tight">
                    {row.stepLabel}
                  </span>
                </div>
                {/* バンド配置領域 */}
                <div
                  className="relative"
                  style={{ width: totalWidth, height: ROW_HEIGHT }}
                >
                  {row.blocks.map((b) => {
                    const meta = BAND_META[b.bandType];
                    const left = timeToPx(b.startAt, viewStartMs, pxPerHour);
                    const width = durationToWidthPx(
                      b.durationMinutes,
                      pxPerHour,
                    );
                    return (
                      <div
                        key={`${b.stepId}-${b.startAt}`}
                        className="absolute top-1 bottom-1 rounded-md border-2 flex items-center px-1.5 overflow-hidden"
                        style={{
                          left,
                          width,
                          background: meta.fill,
                          borderColor: meta.border,
                          color: meta.text,
                        }}
                        title={`${row.stepLabel}（${b.durationMinutes}分）`}
                        data-testid="gantt-block"
                        data-band-type={b.bandType}
                        data-step-label={row.stepLabel}
                      >
                        {(b.bandType === "saboru" || b.bandType === "busy") &&
                          width > 40 && (
                            <span className="text-[10px] font-bold whitespace-nowrap truncate">
                              {b.bandType === "saboru"
                                ? "さぼろう"
                                : row.stepLabel}
                            </span>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 凡例チップ */
function Legend({ bandType }: { bandType: BandType }) {
  const meta = BAND_META[bandType];
  return (
    <span className="flex items-center gap-1 text-saboru-ink-soft">
      <span
        className="inline-block w-2.5 h-2.5 rounded-full border"
        style={{ background: meta.fill, borderColor: meta.border }}
      />
      {meta.label}
    </span>
  );
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatNowChip(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
