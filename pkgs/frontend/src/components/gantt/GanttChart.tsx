import {
  hasOverlap,
  isEditableBand,
  moveDecisionBlock,
  moveWorkBlock,
  resizeWorkBlock,
} from "@/lib/ganttEdit";
import {
  BAND_META,
  buildRows,
  buildTimeTicks,
  durationToWidthPx,
  filterScheduleByDay,
  pxToMinutes,
  pxToTime,
  snapToGrid,
  timeToPx,
  viewWidthPx,
} from "@/lib/ganttLayout";
import { cn } from "@/lib/utils";
import type { BandType, SaboriSchedule, ScheduleBlock } from "@saboru/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  /**
   * 編集（ドラッグ移動・リサイズ）を有効にするか。
   * 既定 false（純表示）。true のとき work/decision を Google Calendar 風に編集できる。
   */
  editable?: boolean;
  /**
   * 編集確定（pointerUp）時に呼ばれる。
   * その時点で表示中（当日）の編集後ブロック群を渡す。
   * 呼び出し側はここから plannedSteps を再構成して保存する。
   */
  onBlocksCommit?: (blocks: ScheduleBlock[]) => void;
}

/** ドラッグ操作の進行状態 */
type DragState =
  | { kind: "move"; stepId: string; startClientX: number }
  | {
      kind: "resize";
      stepId: string;
      edge: "start" | "end";
      startClientX: number;
    }
  | null;

/** 端リサイズハンドルのヒット幅（px） */
const RESIZE_HANDLE_PX = 8;

const LABEL_COL_PX = 116;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 28;

export function GanttChart({
  schedule,
  now,
  className,
  pxPerHour = 120,
  editable = false,
  onBlocksCommit,
}: GanttChartProps) {
  // 表示対象の日（1日単位）。デフォルトは現在日。
  // 「左右無限」方針: スケジュール期間でクランプせず、過去・未来どの日でも開ける。
  // 締切が翌日以降のタスクでも、まずは「今日やる分」を見せる。
  const [viewDate, setViewDate] = useState<Date>(() => now ?? new Date());

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

  // 編集中の上書きブロック（stepId → 編集後 ScheduleBlock）。
  // 楽観更新の即時反映用。schedule/日付が変わったらリセットする。
  const [overrides, setOverrides] = useState<Map<string, ScheduleBlock>>(
    () => new Map(),
  );
  // schedule/日付が変わったら編集中の上書きを破棄する。外部 state（取得結果）との
  // 同期目的のため effect で setState する（cascading render は意図的・許容）。
  // biome-ignore lint/correctness/useExhaustiveDependencies: schedule/日付変更時に編集中の上書きを破棄する意図
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOverrides(new Map());
  }, [schedule, viewDate]);

  // 進行中ドラッグの状態（pointer 操作の途中経過）
  const dragRef = useRef<DragState>(null);
  // ドラッグ開始時点の対象ブロック（差分計算の基点）
  const dragOriginRef = useRef<ScheduleBlock | null>(null);
  // ドラッグ中の最新編集ブロック（commit 時に stale closure を避けるための ref）
  const pendingBlockRef = useRef<ScheduleBlock | null>(null);
  // ドラッグ中ゴーストのラベル（「09:15」等）を表示するための state
  const [ghostLabel, setGhostLabel] = useState<string | null>(null);
  // ドラッグ中のブロック stepId（描画でのハイライト用。ref を render で読まない）
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);

  // 日付ナビ: 「左右無限」方針により、過去・未来どの日にも常に移動できる。
  // 前後ボタンは常時表示・常時有効（スケジュール期間で制限しない）。
  const shiftDay = (delta: number) => {
    setViewDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  };

  const viewStartMs = new Date(view.viewStartAt).getTime();

  // 編集中の上書きを反映した実効ブロック群（描画・重複判定の基準）
  const effectiveBlocks = useMemo(
    () => view.blocks.map((b) => overrides.get(b.stepId) ?? b),
    [view.blocks, overrides],
  );
  const effectiveView = useMemo(
    () => ({ ...view, blocks: effectiveBlocks }),
    [view, effectiveBlocks],
  );

  const rows = buildRows(effectiveView);
  const ticks = buildTimeTicks(view.viewStartAt, view.viewEndAt, pxPerHour);
  const totalWidth = viewWidthPx(view.viewStartAt, view.viewEndAt, pxPerHour);

  // ── 編集インタラクション（pointer events / mouse・touch 両対応） ──

  /** ブロック上で pointerDown: ドラッグ開始（編集可否はバンドで判定） */
  const handleBlockPointerDown = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      block: ScheduleBlock,
      mode: { kind: "move" } | { kind: "resize"; edge: "start" | "end" },
    ) => {
      if (!editable || !isEditableBand(block.bandType)) return;
      // decision はリサイズ不可（固定枠）。move のみ許可。
      if (block.bandType === "decision" && mode.kind === "resize") return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragOriginRef.current = block;
      dragRef.current =
        mode.kind === "move"
          ? { kind: "move", stepId: block.stepId, startClientX: e.clientX }
          : {
              kind: "resize",
              stepId: block.stepId,
              edge: mode.edge,
              startClientX: e.clientX,
            };
      setGhostLabel(formatNowChip(new Date(block.startAt)));
      setDraggingStepId(block.stepId);
    },
    [editable],
  );

  /** pointerMove: 移動量(px)→分に変換し、上書きブロックを更新（即時反映） */
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const origin = dragOriginRef.current;
      if (!drag || !origin) return;
      const deltaPx = e.clientX - drag.startClientX;

      if (drag.kind === "move") {
        // 移動: 開始 px を求め、15分スナップで新しい開始時刻へ
        const originLeftPx = timeToPx(origin.startAt, viewStartMs, pxPerHour);
        const newStartIso = pxToTime(
          originLeftPx + deltaPx,
          viewStartMs,
          pxPerHour,
        );
        // work / decision ともに長さを維持して開始時刻を変更する。
        // blocksToPlannedSteps が work の startAt を anchorAt として書き出すことで永続化される。
        const moved =
          origin.bandType === "work"
            ? moveWorkBlock(origin, newStartIso)
            : moveDecisionBlock(origin, newStartIso);
        pendingBlockRef.current = moved;
        setOverrides((prev) => new Map(prev).set(origin.stepId, moved));
        setGhostLabel(formatNowChip(new Date(newStartIso)));
        return;
      }

      // リサイズ（work のみ）: 端の移動量を長さの増減に変換
      const deltaMinRaw = pxToMinutes(deltaPx, pxPerHour);
      const signed = drag.edge === "end" ? deltaMinRaw : -deltaMinRaw;
      const newDur = snapToGrid(Math.max(5, origin.durationMinutes + signed));
      const resized = resizeWorkBlock(origin, drag.edge, newDur);
      pendingBlockRef.current = resized;
      setOverrides((prev) => new Map(prev).set(origin.stepId, resized));
      setGhostLabel(`${newDur}分`);
    },
    [pxPerHour, viewStartMs],
  );

  /** pointerUp/cancel: 確定して onBlocksCommit、ドラッグ状態をクリア */
  const handlePointerUp = useCallback(() => {
    const drag = dragRef.current;
    const pending = pendingBlockRef.current;
    dragRef.current = null;
    dragOriginRef.current = null;
    pendingBlockRef.current = null;
    setGhostLabel(null);
    setDraggingStepId(null);
    // ドラッグせず（移動なし）に離した場合は pending が無い → commit しない
    if (!drag || !pending) return;
    // 確定時点の実効ブロック群（当日分）。最新の編集は ref から反映する。
    const committed = view.blocks.map((b) =>
      b.stepId === pending.stepId ? pending : (overrides.get(b.stepId) ?? b),
    );
    onBlocksCommit?.(committed);
  }, [view.blocks, overrides, onBlocksCommit]);

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
    <div className={cn("card-brutal overflow-hidden relative", className)}>
      {/* ドラッグ中ゴーストラベル（新しい時刻 / 長さを表示） */}
      {editable && ghostLabel && (
        <div
          data-testid="gantt-ghost-label"
          className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-saboru-heavy text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg pointer-events-none"
        >
          {ghostLabel}
        </div>
      )}
      {/* ヘッダー: 日付（+複数日なら前後ナビ）+ 凡例 */}
      <div className="flex items-center justify-between px-3 py-2 border-b-[3px] border-saboru-heavy">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            aria-label="前日"
            className="w-6 h-6 flex items-center justify-center rounded-md border-2 border-saboru-heavy text-saboru-ink text-xs font-bold hover:bg-saboru-line-soft"
          >
            ‹
          </button>
          <span className="font-extrabold text-saboru-ink text-sm whitespace-nowrap">
            {formatDateHeader(view.viewStartAt)}
          </span>
          <button
            type="button"
            onClick={() => shiftDay(1)}
            aria-label="翌日"
            className="w-6 h-6 flex items-center justify-center rounded-md border-2 border-saboru-heavy text-saboru-ink text-xs font-bold hover:bg-saboru-line-soft"
          >
            ›
          </button>
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
                {/* バンド配置領域（編集時は pointer move/up を受ける） */}
                <div
                  className="relative"
                  style={{ width: totalWidth, height: ROW_HEIGHT }}
                  onPointerMove={editable ? handlePointerMove : undefined}
                  onPointerUp={editable ? handlePointerUp : undefined}
                  onPointerCancel={editable ? handlePointerUp : undefined}
                >
                  {row.blocks.map((b) => {
                    const meta = BAND_META[b.bandType];
                    const left = timeToPx(b.startAt, viewStartMs, pxPerHour);
                    const width = durationToWidthPx(
                      b.durationMinutes,
                      pxPerHour,
                    );
                    const canEdit = editable && isEditableBand(b.bandType);
                    const canResize = canEdit && b.bandType === "work";
                    const overlapping =
                      canEdit && hasOverlap(b, effectiveBlocks);
                    const isDragging = draggingStepId === b.stepId;
                    return (
                      <div
                        key={`${b.stepId}-${b.startAt}`}
                        data-testid={`gantt-block-${b.stepId}`}
                        data-bandtype={b.bandType}
                        data-overlap={overlapping ? "true" : undefined}
                        className={cn(
                          "absolute top-1 bottom-1 rounded-md border-2 flex items-center px-1.5 overflow-hidden select-none touch-none",
                          canEdit && "cursor-grab active:cursor-grabbing",
                          isDragging && "shadow-lg z-10 opacity-90",
                        )}
                        style={{
                          left,
                          width,
                          background: meta.fill,
                          // 重複時は警告として赤枠にする（保存は許可）
                          borderColor: overlapping ? "#EF4444" : meta.border,
                          color: meta.text,
                        }}
                        title={`${row.stepLabel}（${b.durationMinutes}分）${
                          overlapping ? " ⚠ 予定と重複しています" : ""
                        }`}
                        role={canEdit ? "button" : undefined}
                        aria-label={
                          canEdit
                            ? `${row.stepLabel} ${b.durationMinutes}分（ドラッグで移動・端でリサイズ）`
                            : undefined
                        }
                        onPointerDown={
                          canEdit
                            ? (e) =>
                                handleBlockPointerDown(e, b, { kind: "move" })
                            : undefined
                        }
                      >
                        {(b.bandType === "saboru" || b.bandType === "busy") &&
                          width > 40 && (
                            <span className="text-[10px] font-bold whitespace-nowrap truncate">
                              {b.bandType === "saboru"
                                ? "さぼろう"
                                : row.stepLabel}
                            </span>
                          )}
                        {/* リサイズハンドル（work のみ。左右端） */}
                        {canResize && (
                          <>
                            <div
                              data-testid={`gantt-resize-start-${b.stepId}`}
                              className="absolute left-0 top-0 bottom-0 cursor-ew-resize"
                              style={{ width: RESIZE_HANDLE_PX }}
                              onPointerDown={(e) =>
                                handleBlockPointerDown(e, b, {
                                  kind: "resize",
                                  edge: "start",
                                })
                              }
                              aria-hidden="true"
                            />
                            <div
                              data-testid={`gantt-resize-end-${b.stepId}`}
                              className="absolute right-0 top-0 bottom-0 cursor-ew-resize"
                              style={{ width: RESIZE_HANDLE_PX }}
                              onPointerDown={(e) =>
                                handleBlockPointerDown(e, b, {
                                  kind: "resize",
                                  edge: "end",
                                })
                              }
                              aria-hidden="true"
                            />
                          </>
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
