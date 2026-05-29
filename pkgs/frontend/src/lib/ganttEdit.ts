import type { ScheduleBlock, ScheduleStep } from "@saboru/shared";
import { blocksOverlap } from "./ganttLayout";

/**
 * ganttEdit — ガントのインタラクティブ編集（ドラッグ/リサイズ）の純ロジック
 *
 * Google Calendar 風の編集体験を支える「計算部分」を描画から分離する。
 * - 編集可否判定（work/decision=可、saboru/busy=不可）
 * - 編集結果（ブロック群）→ 保存用 plannedSteps（ScheduleStep[]）への変換
 * - 重複警告（自由配置は許可しつつ視覚警告のためのオーバーラップ検出）
 *
 * 永続化の設計判断（重要）:
 * - decision: decisionAt を直接保持できるため「移動」が plannedSteps に反映できる。
 *   固定枠（時刻アンカー）なので長さ変更（リサイズ）は不可とする。
 * - work: ScheduleStep に anchorAt（開始時刻アンカー）が追加されたため、
 *   「自由移動（開始時刻固定）」が永続化できる。移動結果の startAt を anchorAt
 *   として保存し、calcSchedule がそれを固定アンカーとして扱う。
 *   リサイズ（durationMinutes）との両立も可能。
 */

/** ガント上で編集可能なバンド種別か（work / decision のみ） */
export function isEditableBand(bandType: ScheduleBlock["bandType"]): boolean {
  return bandType === "work" || bandType === "decision";
}

/**
 * 編集中のブロック（表示用 ScheduleBlock）から、保存用 plannedSteps を再構成する。
 *
 * - work/decision ブロックのみを対象（saboru/busy は plannedSteps に含めない）
 * - 出現順を維持する（calcSchedule は配列順に後ろ詰めするため順序が意味を持つ）
 * - work: durationMinutes をそのまま採用（リサイズ結果）。
 *   ドラッグ移動で startAt が変化している場合は anchorAt として保存する（永続化）。
 *   anchorAt を持つ work は calcSchedule で固定アンカーとして扱われる。
 * - decision: startAt を decisionAt として採用（移動結果）。固定枠のため
 *   durationMinutes は元の値を維持する。
 *
 * decisionAt / anchorAt はオフセット付き ISO が望ましいが、ブロックの startAt は
 * UTC(Z) の ISO 文字列であり、サーバ側スキーマ（offset: true）は Z 形式も許容する。
 */
export function blocksToPlannedSteps(
  blocks: ScheduleBlock[],
  /** 元のブロック群（anchorAt 付与を省略できるオリジン比較用。省略時は常に anchorAt を付与） */
  originalBlocks?: ScheduleBlock[],
): ScheduleStep[] {
  const origMap = originalBlocks
    ? new Map(originalBlocks.map((b) => [b.stepId, b]))
    : null;

  return blocks
    .filter((b) => isEditableBand(b.bandType))
    .map((b) => {
      const step: ScheduleStep = {
        stepId: b.stepId,
        stepLabel: b.stepLabel,
        durationMinutes: b.durationMinutes,
        bandType: b.bandType as "work" | "decision",
      };
      if (b.bandType === "decision") {
        // 意思決定は開始時刻を時刻アンカー（decisionAt）として保存する
        step.decisionAt = b.startAt;
      } else if (b.bandType === "work") {
        // work は移動された場合のみ anchorAt を付与する。
        // origMap がある場合は元の startAt と比較し、変化があれば anchorAt とする。
        // origMap が無い場合は常に anchorAt を付与する（移動済みと見なす）。
        const orig = origMap?.get(b.stepId);
        if (!orig || orig.startAt !== b.startAt) {
          step.anchorAt = b.startAt;
        } else if (
          orig &&
          (orig as ScheduleBlock & { anchorAt?: string }).anchorAt
        ) {
          // 元のブロックに anchorAt がある（前回保存時に移動済み）場合はそれを引き継ぐ
          // ScheduleBlock 型には anchorAt がないため unknown 経由でアクセス
          const prevAnchorAt = (orig as unknown as { anchorAt?: string })
            .anchorAt;
          if (prevAnchorAt) step.anchorAt = prevAnchorAt;
        }
      }
      if (b.rationale) step.rationale = b.rationale;
      return step;
    });
}

/**
 * 指定ブロックが、同一スケジュール内の他ブロック（work/decision/busy）と
 * 時間的に重なっているかを判定する（自分自身は除外）。
 *
 * saboru 帯は「空き時間」を表すため重なり判定の対象外。
 * 重なっても保存は許可する方針なので、戻り値は「視覚警告を出すか」に使う。
 */
export function hasOverlap(
  target: ScheduleBlock,
  blocks: ScheduleBlock[],
): boolean {
  const ts = new Date(target.startAt).getTime();
  const te = new Date(target.endAt).getTime();
  return blocks.some((b) => {
    if (b === target) return false;
    if (b.stepId === target.stepId && b.startAt === target.startAt)
      return false;
    if (b.bandType === "saboru") return false;
    const bs = new Date(b.startAt).getTime();
    const be = new Date(b.endAt).getTime();
    return blocksOverlap(ts, te, bs, be);
  });
}

/**
 * decision ブロックを新しい開始時刻（移動結果）へ更新した新しいブロックを返す。
 * 固定枠のため長さ（durationMinutes / 区間幅）は維持し、endAt を再計算する。
 */
export function moveDecisionBlock(
  block: ScheduleBlock,
  newStartAtIso: string,
): ScheduleBlock {
  const durMs =
    new Date(block.endAt).getTime() - new Date(block.startAt).getTime();
  const startMs = new Date(newStartAtIso).getTime();
  return {
    ...block,
    startAt: newStartAtIso,
    endAt: new Date(startMs + durMs).toISOString(),
  };
}

/**
 * work ブロックを新しい開始時刻（移動結果）へ更新した新しいブロックを返す。
 * decision と同様に長さ（durationMinutes / 区間幅）は維持し、endAt を再計算する。
 * blocksToPlannedSteps で startAt が anchorAt として保存されることで永続化される。
 */
export function moveWorkBlock(
  block: ScheduleBlock,
  newStartAtIso: string,
): ScheduleBlock {
  const durMs =
    new Date(block.endAt).getTime() - new Date(block.startAt).getTime();
  const startMs = new Date(newStartAtIso).getTime();
  return {
    ...block,
    startAt: newStartAtIso,
    endAt: new Date(startMs + durMs).toISOString(),
  };
}

/**
 * work ブロックをリサイズ（長さ変更）した新しいブロックを返す。
 *
 * @param edge "start"（左端）/ "end"（右端）どちらを掴んだか
 * @param newDurationMinutes スナップ後の新しい長さ（分）。最小5分にクランプ。
 *
 * 左端リサイズは「開始を動かして終了を固定」する見た目だが、保存上は
 * durationMinutes のみが意味を持つ（calcSchedule が後ろ詰め再配置する）。
 * 表示の一貫性のため endAt 基準で startAt を巻き戻して区間を作る。
 */
export function resizeWorkBlock(
  block: ScheduleBlock,
  edge: "start" | "end",
  newDurationMinutes: number,
): ScheduleBlock {
  const dur = Math.max(5, Math.round(newDurationMinutes));
  const durMs = dur * 60_000;
  if (edge === "end") {
    const startMs = new Date(block.startAt).getTime();
    return {
      ...block,
      durationMinutes: dur,
      endAt: new Date(startMs + durMs).toISOString(),
    };
  }
  // 左端: 終了を固定して開始を巻き戻す
  const endMs = new Date(block.endAt).getTime();
  return {
    ...block,
    durationMinutes: dur,
    startAt: new Date(endMs - durMs).toISOString(),
  };
}
