/**
 * workHours.ts — 稼働時間モデル（固定）
 *
 * SABOROU は稼働時間を「8:00〜17:00、昼休み 12:00〜13:00」に固定する。
 * カレンダー密度・今日の余白・ガント描画レンジはすべてこの基準から算出する。
 *
 * 純粋関数で構成し、テスタビリティを確保する（now は引数で受ける）。
 */

export const WORK_START_HOUR = 8;
export const WORK_END_HOUR = 17;
export const LUNCH_START_HOUR = 12;
export const LUNCH_END_HOUR = 13;

/** 1日の総稼働分数（昼休みを除く）= (17-8) - (13-12) = 8時間 = 480分 */
export const TOTAL_WORK_MINUTES =
  (WORK_END_HOUR - WORK_START_HOUR - (LUNCH_END_HOUR - LUNCH_START_HOUR)) * 60;

/** 指定日の稼働開始時刻（その日の 8:00） */
export function workStartOf(now: Date): Date {
  const d = new Date(now);
  d.setHours(WORK_START_HOUR, 0, 0, 0);
  return d;
}

/** 指定日の稼働終了時刻（その日の 17:00） */
export function workEndOf(now: Date): Date {
  const d = new Date(now);
  d.setHours(WORK_END_HOUR, 0, 0, 0);
  return d;
}

/** 指定時刻が昼休み(12:00〜13:00)内か */
export function isLunch(now: Date): boolean {
  const h = now.getHours();
  return h >= LUNCH_START_HOUR && h < LUNCH_END_HOUR;
}

/** 指定時刻が稼働時間内(8:00〜17:00、昼休み除く)か */
export function isWithinWorkHours(now: Date): boolean {
  const h = now.getHours();
  return h >= WORK_START_HOUR && h < WORK_END_HOUR && !isLunch(now);
}

/**
 * 今この瞬間から稼働終了(17:00)までに残っている稼働分数。
 * 昼休みは差し引く。稼働時間外は 0 または満枠を返す。
 */
export function remainingWorkMinutes(now: Date): number {
  const start = workStartOf(now);
  const end = workEndOf(now);

  if (now <= start) return TOTAL_WORK_MINUTES; // 始業前
  if (now >= end) return 0; // 終業後

  let remaining = Math.round((end.getTime() - now.getTime()) / 60000);

  // 現在が昼休み前なら、残り時間にまだ昼休み 60 分が含まれるので差し引く
  const lunchStart = new Date(now);
  lunchStart.setHours(LUNCH_START_HOUR, 0, 0, 0);
  const lunchEnd = new Date(now);
  lunchEnd.setHours(LUNCH_END_HOUR, 0, 0, 0);

  if (now < lunchStart) {
    remaining -= 60; // 丸ごと昼休みが残っている
  } else if (now < lunchEnd) {
    // 昼休みの途中: 昼休み終了までの分を差し引く
    remaining -= Math.round((lunchEnd.getTime() - now.getTime()) / 60000);
  }

  return Math.max(0, remaining);
}

/** 経過した稼働分数（始業 8:00 から now まで、昼休み除く） */
export function elapsedWorkMinutes(now: Date): number {
  return Math.max(0, TOTAL_WORK_MINUTES - remainingWorkMinutes(now));
}

/** HH:MM 表記（24時間） */
export function formatHm(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** 分数を「Xh Ym」「Y分」表記に整形 */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h${rem}m`;
}
