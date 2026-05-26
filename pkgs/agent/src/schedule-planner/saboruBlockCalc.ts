import type { BusySlot, ScheduleBlock } from "@saboru/shared";
import type { ScheduleStep } from "./tools.js";

/**
 * saboruBlockCalc — さぼろう帯の決定論的算出
 *
 * LLM が返した作業ステップ（work/decision）を、now〜windowEnd の利用可能時間に
 * カレンダー予定（busy slot）を避けながら順番に配置する。
 * 作業ステップ以外の空き時間（利用可能区間内）が「さぼろう」帯になる。
 *
 * 設計方針:
 * - LLM には時間配置を任せない（ハルシネーション回避）。配置は決定論的に計算する。
 * - 純関数 + 単純な単一パスで実装し、全分岐をテストで網羅できるようにする。
 * - busy 区間（カレンダー予定）はさぼろう帯にしない。空けておく（予定で埋まっている）。
 */

const MS_PER_MIN = 60_000;

/** 時間区間（ミリ秒エポック） */
export interface Interval {
  start: number;
  end: number;
}

/**
 * busy 区間を正規化する（窓でクランプ + 時刻順ソート + 重複/隣接マージ）。
 */
export function normalizeBusySlots(
  busySlots: BusySlot[],
  windowStart: number,
  windowEnd: number,
): Interval[] {
  const clamped: Interval[] = [];
  for (const slot of busySlots) {
    const start = Math.max(new Date(slot.startAt).getTime(), windowStart);
    const end = Math.min(new Date(slot.endAt).getTime(), windowEnd);
    if (end > start) {
      clamped.push({ start, end });
    }
  }
  clamped.sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const cur of clamped) {
    const last = merged[merged.length - 1];
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * 利用可能スロット（busy を除いた空き区間）を求める。
 */
export function buildAvailableSlots(
  windowStart: number,
  windowEnd: number,
  busy: Interval[],
): Interval[] {
  const available: Interval[] = [];
  let cursor = windowStart;
  for (const b of busy) {
    if (b.start > cursor) {
      available.push({ start: cursor, end: b.start });
    }
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < windowEnd) {
    available.push({ start: cursor, end: windowEnd });
  }
  return available;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

export interface CalcScheduleResult {
  blocks: ScheduleBlock[];
  totalSaboruMinutes: number;
}

/**
 * 窓終端（windowEnd）を決める。
 * - 締切あり: 締切時刻。ただし現在より過去/同時なら作業合計ぶんを確保。
 * - 締切なし: now + 作業合計 + 4h バッファ（最低 now+8h）。
 */
export function resolveWindowEnd(
  windowStart: number,
  deadline: string | null,
  totalWorkMin: number,
): number {
  if (deadline === null) {
    const fallback = windowStart + (totalWorkMin + 240) * MS_PER_MIN;
    return Math.max(fallback, windowStart + 8 * 60 * MS_PER_MIN);
  }
  const dl = new Date(deadline).getTime();
  if (dl <= windowStart) {
    return windowStart + totalWorkMin * MS_PER_MIN;
  }
  return dl;
}

/**
 * 作業ステップを利用可能スロットに配置し、さぼろう帯で埋めた ScheduleBlock 配列を返す。
 *
 * アルゴリズム（単一パス・貪欲法）:
 *   1. 利用可能スロット（busy除去後）を時系列で得る
 *   2. スロットを順に走査。各スロット内で:
 *      - 未配置ステップがあれば詰められるだけ詰める（収まらないステップは次スロットへ持ち越し）
 *      - ステップ配置後のスロット内残り = さぼろう帯
 *   3. 全ステップ配置後の利用可能空き = さぼろう帯
 *   4. ステップが余ったら（空き不足=締切超過）窓末尾に押し込む（はみ出し許容）
 */
export function calcSchedule(params: {
  steps: ScheduleStep[];
  busySlots: BusySlot[];
  now: string;
  deadline: string | null;
}): CalcScheduleResult {
  const { steps, busySlots, now, deadline } = params;

  const windowStart = new Date(now).getTime();
  const totalWorkMin = steps.reduce((s, st) => s + st.durationMinutes, 0);
  const windowEnd = resolveWindowEnd(windowStart, deadline, totalWorkMin);

  const busy = normalizeBusySlots(busySlots, windowStart, windowEnd);
  const available = buildAvailableSlots(windowStart, windowEnd, busy);

  const blocks: ScheduleBlock[] = [];
  let totalSaboruMinutes = 0;
  let saboruSeq = 0;
  let stepIdx = 0;

  const pushSaboru = (start: number, end: number): void => {
    if (end <= start) return;
    blocks.push(buildSaboruBlock(saboruSeq++, start, end));
    totalSaboruMinutes += Math.round((end - start) / MS_PER_MIN);
  };

  // 各利用可能スロットを走査し、ステップを詰めていく
  for (const slot of available) {
    let cursor = slot.start;
    while (stepIdx < steps.length) {
      const step = steps[stepIdx];
      const needMs = step.durationMinutes * MS_PER_MIN;
      if (cursor + needMs <= slot.end) {
        // このスロットに収まる
        blocks.push(buildWorkBlock(step, cursor, cursor + needMs));
        cursor += needMs;
        stepIdx++;
      } else {
        // 収まらない: このステップは次スロットへ持ち越し
        break;
      }
    }
    // スロット内に残った空きはさぼろう帯
    pushSaboru(cursor, slot.end);
  }

  // ステップが余った（締切までに収まらない）: 窓末尾以降に押し込む
  if (stepIdx < steps.length) {
    let cursor = windowEnd;
    for (; stepIdx < steps.length; stepIdx++) {
      const step = steps[stepIdx];
      const needMs = step.durationMinutes * MS_PER_MIN;
      blocks.push(buildWorkBlock(step, cursor, cursor + needMs));
      cursor += needMs;
    }
  }

  // 時系列順にソート（はみ出しステップを正しい位置へ）
  blocks.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  return { blocks, totalSaboruMinutes };
}

function buildWorkBlock(
  step: ScheduleStep,
  startMs: number,
  endMs: number,
): ScheduleBlock {
  return {
    stepId: step.stepId,
    stepLabel: step.stepLabel,
    bandType: step.bandType,
    startAt: toIso(startMs),
    endAt: toIso(endMs),
    durationMinutes: Math.round((endMs - startMs) / MS_PER_MIN),
    ...(step.rationale ? { rationale: step.rationale } : {}),
  };
}

function buildSaboruBlock(
  seq: number,
  startMs: number,
  endMs: number,
): ScheduleBlock {
  return {
    stepId: `saboru_${seq}`,
    stepLabel: "さぼろう",
    bandType: "saboru",
    startAt: toIso(startMs),
    endAt: toIso(endMs),
    durationMinutes: Math.round((endMs - startMs) / MS_PER_MIN),
  };
}
