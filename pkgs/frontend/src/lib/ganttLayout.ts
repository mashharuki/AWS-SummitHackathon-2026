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
  busy: {
    label: "予定",
    fill: "#E5E7EB", // グレー（塗り）— カレンダー予定で埋まっている
    border: "#6B7280",
    text: "#374151",
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
 * - busy（カレンダー予定）は件数が多いと縦に肥大化するため「予定」1行に集約する
 */
export function buildRows(schedule: SaboriSchedule): GanttRowData[] {
  const saboruBlocks = schedule.blocks.filter((b) => b.bandType === "saboru");
  const busyBlocks = schedule.blocks.filter((b) => b.bandType === "busy");
  const workBlocks = schedule.blocks.filter(
    (b) => b.bandType !== "saboru" && b.bandType !== "busy",
  );

  const rows: GanttRowData[] = [];

  // 最上段: さぼろう行は常にトップに置く（ブロックが無くても空レーンを表示）。
  // 「さぼろう」は SABOROU の主役なので、当日にさぼり時間が無くても
  // レーン自体は常に見せて存在を示す。
  rows.push({
    stepLabel: "さぼろう",
    bandType: "saboru",
    blocks: saboruBlocks,
  });

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

  // 予定（busy）は1レーンに集約（複数予定でも縦に増やさない）。
  // 個々の予定名はブロックの stepLabel に保持され、バー上に表示される。
  if (busyBlocks.length > 0) {
    rows.push({
      stepLabel: "予定",
      bandType: "busy",
      blocks: busyBlocks,
    });
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

/** 1日の表示範囲（ローカルタイム基準） */
export interface DayRange {
  /** 表示開始（ISO）。当日は now 起点、他日は 00:00 起点 */
  startAt: string;
  /** 表示終了（ISO）。締切がその日中なら締切、それ以外はその日の 23:59:59.999 */
  endAt: string;
}

/** ローカルタイムでその日の 00:00:00.000 を返す */
function startOfLocalDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

/** ローカルタイムでその日の 23:59:59.999 を返す */
function endOfLocalDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

/** 2つの Date が同じローカル日付か */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * 指定日の表示範囲（横軸の開始・終了）を算出する。
 *
 * - 開始: その日が「今日」なら now、それ以外はその日の 00:00。
 *   ただしスケジュールの viewStartAt より前にはしない。
 * - 終了: その日の 23:59:59.999 を基準に、締切がその日中ならそこまで（夜まで伸ばさない）。
 *   さらに schedule.viewEndAt を超えない。
 */
export function getDayRange(
  dayDate: Date,
  schedule: SaboriSchedule,
  now: Date = new Date(),
): DayRange {
  const viewStartMs = new Date(schedule.viewStartAt).getTime();
  const viewEndMs = new Date(schedule.viewEndAt).getTime();
  const deadlineMs = schedule.deadline
    ? new Date(schedule.deadline).getTime()
    : null;

  // 開始: 今日なら now、他日は 00:00。viewStartAt 以上にクランプ。
  const dayStartBase = isSameLocalDay(dayDate, now)
    ? now
    : startOfLocalDay(dayDate);
  const startMs = Math.max(dayStartBase.getTime(), viewStartMs);

  // 終了候補: その日の終わり / 締切（その日中なら）/ viewEnd の最小。
  let endMs = endOfLocalDay(dayDate).getTime();
  if (deadlineMs !== null && isSameLocalDay(new Date(deadlineMs), dayDate)) {
    endMs = Math.min(endMs, deadlineMs);
  }
  endMs = Math.min(endMs, viewEndMs);

  // 開始が終了を超える異常時は最低 1 時間の窓を確保（潰れ防止）。
  if (endMs <= startMs) {
    endMs = startMs + MS_PER_HOUR;
  }

  return {
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
  };
}

/** ブロックが [rangeStartMs, rangeEndMs] と時間的に重なるか */
function blockOverlapsRange(
  b: ScheduleBlock,
  rangeStartMs: number,
  rangeEndMs: number,
): boolean {
  const s = new Date(b.startAt).getTime();
  const e = new Date(b.endAt).getTime();
  return s < rangeEndMs && e > rangeStartMs;
}

/**
 * スケジュールを「指定日の1日分」に絞り込んだ新しいスケジュールを返す（純関数）。
 *
 * - viewStartAt/viewEndAt を当日の表示範囲（getDayRange）にクランプ
 * - blocks は当日範囲と重なるものだけ残す
 * - deadline はその日中なら維持、範囲外なら null（締切ラインを当日に出さない）
 * - totalSaboruMinutes は当日に残った saboru ブロックの合計で再計算
 */
export function filterScheduleByDay(
  schedule: SaboriSchedule,
  dayDate: Date,
  now: Date = new Date(),
): SaboriSchedule {
  const range = getDayRange(dayDate, schedule, now);
  const startMs = new Date(range.startAt).getTime();
  const endMs = new Date(range.endAt).getTime();

  const blocks = schedule.blocks.filter((b) =>
    blockOverlapsRange(b, startMs, endMs),
  );

  const deadlineInDay =
    schedule.deadline !== null &&
    isSameLocalDay(new Date(schedule.deadline), dayDate);

  const totalSaboruMinutes = blocks
    .filter((b) => b.bandType === "saboru")
    .reduce((sum, b) => sum + b.durationMinutes, 0);

  return {
    ...schedule,
    viewStartAt: range.startAt,
    viewEndAt: range.endAt,
    deadline: deadlineInDay ? schedule.deadline : null,
    blocks,
    totalSaboruMinutes,
  };
}

/**
 * デモ/フォールバック用のダミースケジュールを生成する。
 *
 * スケジュールAPIが未取得・失敗のときでもガントを空にせず、
 * 「作業 / 意思決定 / さぼろう」の見本盤面を表示する（デモ映え優先）。
 * now を起点に 3 時間ぶんのサンプル配置を作る。
 */
export function buildDummySchedule(
  taskId: string,
  now: Date = new Date(),
): SaboriSchedule {
  const startMs = now.getTime();
  const at = (min: number): string =>
    new Date(startMs + min * MS_PER_MIN).toISOString();

  const blocks: ScheduleBlock[] = [
    {
      stepId: "saboru_0",
      stepLabel: "さぼろう",
      bandType: "saboru",
      startAt: at(0),
      endAt: at(45),
      durationMinutes: 45,
    },
    {
      stepId: "saboru_1",
      stepLabel: "さぼろう",
      bandType: "saboru",
      startAt: at(75),
      endAt: at(120),
      durationMinutes: 45,
    },
    {
      stepId: "s1",
      stepLabel: "要点を整理",
      bandType: "work",
      startAt: at(45),
      endAt: at(75),
      durationMinutes: 30,
    },
    {
      stepId: "s2",
      stepLabel: "関係者へ確認",
      bandType: "decision",
      startAt: at(120),
      endAt: at(150),
      durationMinutes: 30,
    },
    {
      stepId: "s3",
      stepLabel: "仕上げて提出",
      bandType: "work",
      startAt: at(150),
      endAt: at(180),
      durationMinutes: 30,
    },
  ];

  return {
    taskId,
    generatedAt: at(0),
    viewStartAt: at(0),
    viewEndAt: at(180),
    deadline: at(180),
    blocks,
    totalSaboruMinutes: 90,
    calendarUsed: false,
  };
}
