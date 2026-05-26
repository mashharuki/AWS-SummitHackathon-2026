import type { SaboriSchedule } from "@saboru/shared";
import {
  type SaboriGrade,
  calcSaboriGrade,
  getComboMultiplier,
} from "./gamificationUtils";

/**
 * ganttScoringUtils — ガント結果をゲームスコアに変換する
 *
 * ピッチの思想は変えない。ガント（AIが作業分解してスケジューリングした時間表）から
 * 自然に出る「さぼれた合計時間」を、既存のゲーミフィケーション
 * （スコア・グレード・コンボ）に接続するための配線ロジック。
 *
 * ganttGameScore = totalSaboruMinutes × qualityMultiplier × comboMultiplier
 */

/**
 * 根拠（reasoning）の件数から品質係数を返す。
 * 根拠が多い＝「うまくサボれる正当な理由が揃っている」ほど高評価。
 */
export function qualityMultiplier(reasoningCount: number): number {
  if (reasoningCount >= 3) return 1.5;
  if (reasoningCount === 2) return 1.2;
  if (reasoningCount === 1) return 1.0;
  return 0.5;
}

/**
 * ガントゲームスコアを算出する。
 *
 * @param totalSaboruMinutes - ガントで確保できた「さぼろう」合計時間（分）
 * @param reasoningCount - 判定の根拠件数（質の指標）
 * @param comboCount - 現在のコンボ数
 */
export function calcGanttGameScore(
  totalSaboruMinutes: number,
  reasoningCount: number,
  comboCount: number,
): number {
  const quality = qualityMultiplier(reasoningCount);
  const combo = getComboMultiplier(comboCount);
  return Math.round(totalSaboruMinutes * quality * combo);
}

/** ガントグレード（盤面の出来栄え） */
export type GanttGrade = "S" | "A" | "B" | "C" | "D";

export interface GanttGradeInfo {
  grade: GanttGrade;
  label: string;
  /** 演出強度 */
  intensity: "jackpot" | "high" | "medium" | "low" | "none";
}

/**
 * 確保できたさぼり時間と品質からガントグレードを算出する。
 * 「どれだけうまくサボり時間を勝ち取れたか」の評価。
 */
export function calcGanttGrade(
  totalSaboruMinutes: number,
  reasoningCount: number,
): GanttGradeInfo {
  const quality = qualityMultiplier(reasoningCount);

  if (totalSaboruMinutes >= 60 && quality >= 1.5) {
    return { grade: "S", label: "完全攻略のサボり", intensity: "jackpot" };
  }
  if (totalSaboruMinutes >= 45 && quality >= 1.2) {
    return { grade: "A", label: "見事なサボり配置", intensity: "high" };
  }
  if (totalSaboruMinutes >= 30) {
    return { grade: "B", label: "余裕のサボり時間", intensity: "medium" };
  }
  if (totalSaboruMinutes >= 15) {
    return { grade: "C", label: "ギリギリのサボり", intensity: "low" };
  }
  return { grade: "D", label: "サボる隙が少ない", intensity: "none" };
}

/**
 * ガント由来のボーナスを既存の calcSaboriGrade に注入してグレードを算出する。
 *
 * ガントで確保できたさぼり時間が長いほど signalCount にボーナスが加算され、
 * 既存のサボりグレード（A+〜E）が上振れする。
 * ガントが無い場合は既存ロジックと同じ結果になる。
 */
export function calcGanttAugmentedGrade(params: {
  verdict: "can_saboru" | "borderline" | "must_do";
  signalCount?: number;
  dependencyScore?: number;
  isComboActive?: boolean;
  /** ガントゲームスコア（あれば signalCount にボーナス加算） */
  ganttGameScore?: number;
}): SaboriGrade {
  const {
    verdict,
    signalCount = 0,
    dependencyScore = 0,
    isComboActive = false,
    ganttGameScore,
  } = params;

  // 30 点ごとに +1 シグナル（ガントが無ければボーナス 0 = 既存挙動）
  const ganttBonus = ganttGameScore ? Math.floor(ganttGameScore / 30) : 0;

  return calcSaboriGrade({
    verdict,
    signalCount: signalCount + ganttBonus,
    dependencyScore,
    isComboActive,
  });
}

/**
 * スケジュールからゲームスコア連動に必要な値を抽出する小ヘルパー。
 */
export function extractGanttResult(
  schedule: SaboriSchedule,
  reasoningCount: number,
  comboCount: number,
): {
  ganttGameScore: number;
  totalSaboruMinutes: number;
  grade: GanttGradeInfo;
} {
  return {
    totalSaboruMinutes: schedule.totalSaboruMinutes,
    ganttGameScore: calcGanttGameScore(
      schedule.totalSaboruMinutes,
      reasoningCount,
      comboCount,
    ),
    grade: calcGanttGrade(schedule.totalSaboruMinutes, reasoningCount),
  };
}
