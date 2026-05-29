import type { BusySlot, ScheduleBlock, ScheduleStep } from "@saboru/shared";

/**
 * saboruBlockCalc — 後ろ詰めスケジューリング ＋ さぼろう帯の決定論的算出
 *
 * SABOROU の思想（SABOROU_pitch.md）に沿い、作業は「締切から逆算して後ろに置き、
 * 手前を公式サボり時間にする」。意思決定（decision）は「いつ行うか」＝時刻アンカー
 * （decisionAt）として時間軸に固定し、その手前の作業を逆算配置する。これにより
 * 「アンカー（上司確認など）に間に合えば、それまではサボれる」が表現される。
 *
 * 設計方針:
 * - LLM には時間配置を任せない（ハルシネーション回避）。配置は決定論的に計算する。
 * - 純関数として実装し、全分岐をテストで網羅できるようにする。
 * - busy 区間（カレンダー予定）はさぼろう帯にしない。空けておく（予定で埋まっている）。
 * - さぼろう帯は「窓内の利用可能時間（busy除外）から、配置済みブロックを引いた残り」
 *   として算出する。これにより作業/意思決定の合間に自然にサボり余白が分散する。
 */

const MS_PER_MIN = 60_000;

/** 意思決定（decision）ブロックのガント描画用の固定枠（分）。 */
const DECISION_BLOCK_MIN = 10;

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

/** 配置済みの 1 ステップ（時刻確定後） */
interface PlacedBlock {
  step: ScheduleStep;
  start: number;
  end: number;
}

/**
 * decision ステップの固定アンカー区間 [start, end] を求める。
 * decisionAt があればその時刻、無ければ null（呼び出し側で work と同様に扱う）。
 */
function resolveDecisionAnchor(
  step: ScheduleStep,
  windowStart: number,
  windowEnd: number,
): Interval | null {
  if (!step.decisionAt) return null;
  const at = new Date(step.decisionAt).getTime();
  if (Number.isNaN(at)) return null;
  // 窓内にクランプ。終端は固定枠ぶん確保する。
  const start = Math.min(Math.max(at, windowStart), windowEnd);
  const lenMs = DECISION_BLOCK_MIN * MS_PER_MIN;
  return { start, end: start + lenMs };
}

/**
 * anchorAt 付き work ステップの固定アンカー区間 [start, end] を求める。
 * anchorAt があればその時刻から durationMinutes ぶんの幅で固定配置する。
 * anchorAt が無い、または不正な場合は null（呼び出し側で後ろ詰め扱いにする）。
 *
 * decisionAt と同様の「固定アンカー」概念。差異は長さが durationMinutes で決まる点。
 */
function resolveWorkAnchor(
  step: ScheduleStep,
  windowStart: number,
  windowEnd: number,
): Interval | null {
  // calcSchedule 内で step.anchorAt の存在を確認してから呼ぶため、このガードは
  // 将来の直接呼び出し等への防御的コード。現在のコードパスでは到達しない。
  /* c8 ignore next */
  if (!step.anchorAt) return null;
  const at = new Date(step.anchorAt).getTime();
  if (Number.isNaN(at)) return null;
  // 窓内にクランプ。終端は durationMinutes ぶん確保する。
  const start = Math.min(Math.max(at, windowStart), windowEnd);
  const lenMs = step.durationMinutes * MS_PER_MIN;
  return { start, end: start + lenMs };
}

/**
 * 区間 [segStartBound, segEnd) に work ステップ群を「後ろ詰め（右寄せ）」で配置する。
 * busy（および既配置のブロック = occupied）を避け、segEnd 側から逆順に詰める。
 *
 * @param works     配置する work ステップ（元の時系列順）
 * @param segEnd    この区間の終端（次のアンカー開始 or 窓終端）
 * @param occupied  既に埋まっている区間（busy + 配置済み decision など）。時刻順。
 * @param windowStart 窓開始（これ以上は手前に押し出さない目安。はみ出しは許容）
 * @returns 配置結果（時刻昇順）
 */
function backfillWorks(
  works: ScheduleStep[],
  segEnd: number,
  occupied: Interval[],
  windowStart: number,
): PlacedBlock[] {
  const placed: PlacedBlock[] = [];
  // 後ろのステップから順に、cursor（空き終端）を手前へ動かしながら詰める。
  let cursor = segEnd;
  for (let i = works.length - 1; i >= 0; i--) {
    const step = works[i];
    const needMs = step.durationMinutes * MS_PER_MIN;
    // cursor から手前に needMs ぶんの空きを探す（occupied を避ける）。
    const slotStart = findBackwardSlot(cursor, needMs, occupied, windowStart);
    placed.push({ step, start: slotStart, end: slotStart + needMs });
    cursor = slotStart;
  }
  placed.reverse(); // 時刻昇順へ
  return placed;
}

/**
 * cursor（含む手前）に向かって、長さ needMs の連続空きの開始位置を返す。
 * occupied（時刻順の埋まり区間）に重なる位置は飛ばし、その手前へ回り込む。
 * windowStart より手前にはみ出すことは許容する（締切に間に合わない場合の保険）。
 */
function findBackwardSlot(
  cursor: number,
  needMs: number,
  occupied: Interval[],
  _windowStart: number,
): number {
  let end = cursor;
  // 安全のため有限回で打ち切る（occupied 件数 + 1 回で必ず収束する）。
  for (let guard = 0; guard <= occupied.length + 1; guard++) {
    const start = end - needMs;
    // [start, end) に重なる occupied を探す。
    const conflict = occupied.find((o) => o.start < end && o.end > start);
    if (!conflict) {
      return start;
    }
    // 衝突した occupied の手前（start 側）に end を移動して再探索する。
    end = conflict.start;
  }
  return end - needMs;
}

/** Interval を時刻順にソートしたコピーを返す。 */
function sortedIntervals(intervals: Interval[]): Interval[] {
  return [...intervals].sort((a, b) => a.start - b.start);
}

/**
 * 作業ステップを「締切から逆算して後ろ詰め」し、意思決定を時刻アンカーに固定し、
 * 合間をさぼろう帯で埋めた ScheduleBlock 配列を返す。
 *
 * アルゴリズム（後ろ詰め・決定論）:
 *   1. windowEnd（締切）を決める。
 *   2. decisionAt を持つ decision を固定アンカー（10分枠）として配置。
 *   3. ステップを時系列に走査し、アンカーごとに work 群を区切る。
 *      各 work 群は「次のアンカー開始 / 窓終端」へ右寄せ（後ろ詰め）で配置する。
 *   4. 配置済み（work + decision + busy）以外の窓内利用可能時間を「さぼろう」帯にする。
 *      → 作業・意思決定の合間にサボり余白が分散する。
 *   5. busy をガントに可視化（避ける＋見せる）。
 */
export function calcSchedule(params: {
  steps: ScheduleStep[];
  busySlots: BusySlot[];
  now: string;
  deadline: string | null;
}): CalcScheduleResult {
  const { steps, busySlots, now, deadline } = params;

  const windowStart = new Date(now).getTime();
  // decision は固定枠ぶんを工数として見込み、窓終端の余裕を確保する。
  // anchorAt 付き work は durationMinutes をそのまま使う（後ろ詰め対象外だが工数は同じ）。
  const totalWorkMin = steps.reduce(
    (s, st) =>
      s +
      (st.bandType === "decision" && st.decisionAt
        ? DECISION_BLOCK_MIN
        : st.durationMinutes),
    0,
  );
  const windowEnd = resolveWindowEnd(windowStart, deadline, totalWorkMin);

  const busy = normalizeBusySlots(busySlots, windowStart, windowEnd);

  // フェーズ A: 固定アンカー（decision の decisionAt + work の anchorAt）を確定し、
  // アンカーで区切られたセグメントに残りの work 群を振り分ける。
  //
  // 「固定アンカー」とは: 特定の時刻に固定配置されるステップ。
  //   - decision: decisionAt が指定されたもの（意思決定の時刻アンカー）
  //   - work:     anchorAt が指定されたもの（ドラッグ移動でユーザーが固定した開始時刻）
  //
  // アンカー順（時刻順）にソートし、アンカー間の work 群を後ろ詰めで配置する。
  // 未アンカーの work はアンカー時刻の手前（前のアンカー〜次のアンカー開始）に後ろ詰め。

  // アンカー付きステップ（decision/work とも）を時刻順に解決する。
  interface AnchorEntry {
    step: ScheduleStep;
    interval: Interval;
  }
  const anchorEntries: AnchorEntry[] = [];
  for (const step of steps) {
    if (step.bandType === "decision") {
      const anchor = resolveDecisionAnchor(step, windowStart, windowEnd);
      if (anchor) {
        anchorEntries.push({ step, interval: anchor });
      }
      // decisionAt が無い decision は pendingWorks 側（後ろ詰め）で処理する
    } else if (step.bandType === "work" && step.anchorAt) {
      const anchor = resolveWorkAnchor(step, windowStart, windowEnd);
      if (anchor) {
        anchorEntries.push({ step, interval: anchor });
      }
      // anchorAt が不正な場合は後ろ詰め側で処理する
    }
  }
  // アンカーを時刻順にソート（混在しても決定論的に処理できるように）
  anchorEntries.sort((a, b) => a.interval.start - b.interval.start);

  // アンカーを「配置済み」として記録
  const anchoredPlaced: PlacedBlock[] = anchorEntries.map((e) => ({
    step: e.step,
    start: e.interval.start,
    end: e.interval.end,
  }));

  // アンカー付きステップの stepId セット（後ろ詰み対象から除外するため）
  const anchoredStepIds = new Set(anchorEntries.map((e) => e.step.stepId));

  // セグメント: アンカー間の「後ろ詰め対象 work 群」を区切る。
  // steps の元順を維持しながら、アンカー境界でセグメント分割する。
  // セグメント = { works: 後ろ詰め対象 steps, segEnd: このセグメントの右端時刻 }
  const segments: { works: ScheduleStep[]; segEnd: number }[] = [];
  let pendingWorks: ScheduleStep[] = [];
  // アンカーの処理済みインデックス（steps を線形スキャンしながらアンカーを消費する）
  let anchorIdx = 0;

  for (const step of steps) {
    if (anchoredStepIds.has(step.stepId)) {
      // このステップはアンカー固定配置済み。
      // ここまでの pendingWorks は「このアンカー開始」を右端として後ろ詰めする。
      const anchorEntry = anchorEntries[anchorIdx];
      if (anchorEntry) {
        segments.push({
          works: pendingWorks,
          segEnd: anchorEntry.interval.start,
        });
        pendingWorks = [];
        anchorIdx++;
      }
    } else {
      // アンカーなし（後ろ詰め対象）
      pendingWorks.push(step);
    }
  }
  // 残りの未配置 work 群は窓終端（締切）までに後ろ詰めする。
  segments.push({ works: pendingWorks, segEnd: windowEnd });

  // フェーズ B: 各セグメントを後ろ詰め配置（busy + 固定アンカー を避ける）。
  const occupied: Interval[] = sortedIntervals([
    ...busy,
    ...anchoredPlaced.map((d) => ({ start: d.start, end: d.end })),
  ]);
  const workPlaced: PlacedBlock[] = [];
  for (const seg of segments) {
    if (seg.works.length === 0) continue;
    const placed = backfillWorks(seg.works, seg.segEnd, occupied, windowStart);
    workPlaced.push(...placed);
    // 配置した work も後続セグメントの occupied に加える（区間が重ならないように）。
    for (const p of placed) {
      occupied.push({ start: p.start, end: p.end });
    }
    occupied.sort((a, b) => a.start - b.start);
  }

  // フェーズ C: ブロック生成。
  const blocks: ScheduleBlock[] = [];
  for (const p of workPlaced) {
    blocks.push(buildWorkBlock(p.step, p.start, p.end));
  }
  for (const a of anchoredPlaced) {
    blocks.push(buildWorkBlock(a.step, a.start, a.end));
  }

  // フェーズ D: さぼろう帯 = 窓内利用可能時間（busy除外）から配置済みを引いた残り。
  const occupiedForSaboru = sortedIntervals([
    ...busy,
    ...workPlaced.map((p) => ({ start: p.start, end: p.end })),
    ...anchoredPlaced.map((a) => ({ start: a.start, end: a.end })),
  ]);
  const mergedOccupied = mergeIntervals(occupiedForSaboru);
  let totalSaboruMinutes = 0;
  let saboruSeq = 0;
  let cursor = windowStart;
  for (const occ of mergedOccupied) {
    if (occ.start > cursor) {
      const gapStart = cursor;
      const gapEnd = Math.min(occ.start, windowEnd);
      if (gapEnd > gapStart) {
        blocks.push(buildSaboruBlock(saboruSeq++, gapStart, gapEnd));
        totalSaboruMinutes += Math.round((gapEnd - gapStart) / MS_PER_MIN);
      }
    }
    cursor = Math.max(cursor, occ.end);
  }
  if (cursor < windowEnd) {
    blocks.push(buildSaboruBlock(saboruSeq++, cursor, windowEnd));
    totalSaboruMinutes += Math.round((windowEnd - cursor) / MS_PER_MIN);
  }

  // フェーズ E: カレンダー予定を busy ブロックとして可視化する。
  let busySeq = 0;
  for (const slot of busySlots) {
    const slotStart = Math.max(new Date(slot.startAt).getTime(), windowStart);
    const slotEnd = Math.min(new Date(slot.endAt).getTime(), windowEnd);
    if (slotEnd > slotStart) {
      blocks.push(buildBusyBlock(busySeq++, slotStart, slotEnd, slot.title));
    }
  }

  // 時系列順にソート。
  blocks.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  return { blocks, totalSaboruMinutes };
}

/** 時刻順の区間配列を重複/隣接マージする。 */
function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = sortedIntervals(intervals);
  const merged: Interval[] = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
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

/**
 * カレンダー予定の busy ブロックを作る。
 * stepLabel には予定名（title）を使い、無ければ「予定」と表示する。
 */
function buildBusyBlock(
  seq: number,
  startMs: number,
  endMs: number,
  title?: string,
): ScheduleBlock {
  const label = title?.trim() || "予定";
  return {
    stepId: `busy_${seq}`,
    stepLabel: label,
    bandType: "busy",
    startAt: toIso(startMs),
    endAt: toIso(endMs),
    durationMinutes: Math.round((endMs - startMs) / MS_PER_MIN),
  };
}
