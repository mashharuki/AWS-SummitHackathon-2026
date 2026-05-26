import type { BandType, SaboriSchedule, ScheduleBlock } from "@saboru/shared";

/**
 * ganttLayout — ガントチャートのレイアウト計算（純関数）
 *
 * 時間 → ピクセルへの変換、行グルーピング、時間目盛りの生成を担う。
 * 描画コンポーネント（GanttChart）から分離してテスト容易にする。
 */

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MIN;

/** バンド種別ごとの表示メタ（色・ラベル） */
export const BAND_META: Record<
  BandType,
  { label: string; fill: string; border: string; text: string }
> = {
  saboru: {
    label: "さぼろう",
    fill: "#D1FADF", // 緑（塗り）
    border: "#12B76A",
    text: "#05603A",
  },
  work: {
    label: "作業",
    fill: "#FFFFFF", // 白（枠線のみ）
    border: "#2B1E16",
    text: "#2B1E16",
  },
  decision: {
    label: "意思決定",
    fill: "#FEF0C7", // 黄（塗り）
    border: "#F79009",
    text: "#93370D",
  },
};

/** 時間軸の目盛り 1 つ */
export interface TimeTick {
  /** 目盛りの時刻（ISO） */
  iso: string;
  /** ビュー開始からのオフセット（px） */
  leftPx: number;
  /** 表示ラベル（HH:MM） */
  label: string;
}

/** ガント 1 行（同一ステップのバンド群） */
export interface GanttRowData {
  stepLabel: string;
  bandType: BandType;
  blocks: ScheduleBlock[];
}

/**
 * 時間（ms）→ ビュー開始からの px オフセットに変換する。
 */
export function timeToPx(
  iso: string,
  viewStartMs: number,
  pxPerHour: number,
): number {
  const ms = new Date(iso).getTime();
  return ((ms - viewStartMs) / MS_PER_HOUR) * pxPerHour;
}

/**
 * バンドの幅（px）を計算する。最小幅 8px を保証して潰れを防ぐ。
 */
export function durationToWidthPx(
  durationMinutes: number,
  pxPerHour: number,
): number {
  const raw = (durationMinutes / 60) * pxPerHour;
  return Math.max(8, raw);
}

/**
 * HH:MM ラベルへ整形する（ローカルタイム）。
 */
export function formatTick(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * ビュー全体の時間目盛りを生成する。
 * stepMinutes 間隔（既定 30 分）で、viewStart を含む直近の区切りから刻む。
 */
export function buildTimeTicks(
  viewStartAt: string,
  viewEndAt: string,
  pxPerHour: number,
  stepMinutes = 30,
): TimeTick[] {
  const viewStartMs = new Date(viewStartAt).getTime();
  const viewEndMs = new Date(viewEndAt).getTime();
  const stepMs = stepMinutes * MS_PER_MIN;

  // viewStart 以上で最初の「区切り時刻」（stepMinutes の倍数, 分単位の床）
  const startDate = new Date(viewStartMs);
  startDate.setSeconds(0, 0);
  const remainder = startDate.getMinutes() % stepMinutes;
  if (remainder !== 0) {
    startDate.setMinutes(startDate.getMinutes() + (stepMinutes - remainder));
  }

  const ticks: TimeTick[] = [];
  for (let t = startDate.getTime(); t <= viewEndMs; t += stepMs) {
    const d = new Date(t);
    ticks.push({
      iso: d.toISOString(),
      leftPx: ((t - viewStartMs) / MS_PER_HOUR) * pxPerHour,
      label: formatTick(d),
    });
  }
  return ticks;
}

/**
 * スケジュールのブロックを「行」にグルーピングする。
 * - 最上段は必ず「さぼろう」行（saboru バンドを集約）
 * - 続いて work/decision を stepLabel の出現順に1行ずつ
 */
export function buildRows(schedule: SaboriSchedule): GanttRowData[] {
  const saboruBlocks = schedule.blocks.filter((b) => b.bandType === "saboru");
  const workBlocks = schedule.blocks.filter((b) => b.bandType !== "saboru");

  const rows: GanttRowData[] = [];

  // 最上段: さぼろう（ブロックがある場合のみ行を作る）
  if (saboruBlocks.length > 0) {
    rows.push({
      stepLabel: "さぼろう",
      bandType: "saboru",
      blocks: saboruBlocks,
    });
  }

  // 作業ステップ: stepLabel ごとに1行（出現順を維持）
  const seen = new Map<string, GanttRowData>();
  for (const b of workBlocks) {
    const existing = seen.get(b.stepId);
    if (existing) {
      existing.blocks.push(b);
    } else {
      const row: GanttRowData = {
        stepLabel: b.stepLabel,
        bandType: b.bandType,
        blocks: [b],
      };
      seen.set(b.stepId, row);
      rows.push(row);
    }
  }

  return rows;
}

/**
 * ビュー全幅（px）を計算する。
 */
export function viewWidthPx(
  viewStartAt: string,
  viewEndAt: string,
  pxPerHour: number,
): number {
  const ms = new Date(viewEndAt).getTime() - new Date(viewStartAt).getTime();
  return (ms / MS_PER_HOUR) * pxPerHour;
}
