/**
 * homeMetrics.ts — ホームタブ「現状把握」の数値算出
 *
 * バックエンドの実データ（CalendarStatus / Proposal の psychSignals）と
 * 稼働時間モデル（workHours）を合成し、ホーム画面の指標を算出する。
 * 集約専用 API は新設せず、拡張フロント側でここに集約する（設計判断 §3-2）。
 *
 * 全関数は純粋関数。データ欠損時はフォールバック値を返し、UI が常に描画できる。
 */

import type { CalendarStatus, Proposal } from "./types";
import {
  TOTAL_WORK_MINUTES,
  remainingWorkMinutes,
  WORK_START_HOUR,
  WORK_END_HOUR,
} from "./workHours";

export type SignalLevel = "low" | "mid" | "high";

export interface HomeMetrics {
  /** 今日の余白（分）。稼働残時間から作業見込みを引いた自由時間 */
  saboruMinutesToday: number;
  /** 認知負荷スコア 0-100（高いほど追い込まれている） */
  cognitiveLoadScore: number;
  /** カレンダー密度 % */
  calendarDensityPct: number;
  /** 即レス圧 % */
  responsePressurePct: number;
  /** 連続稼働分数 */
  continuousWorkMinutes: number;
  /** 文書のトゲ（緊急度）レベル */
  documentSharpness: SignalLevel;
  /** 「このまま行くと」作業が伸びる予測終了時刻 HH:MM */
  predictedEndTime: string;
  /** 余白に対する一言コメント */
  comment: string;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function levelLabel(level: SignalLevel): string {
  return level === "high" ? "注意" : level === "mid" ? "やや高" : "安定";
}

/**
 * psychSignals の high/low/unknown を 0-100 のおおまかな寄与度に変換。
 * unknown は中間値 50 を採用（情報欠損時に極端へ振れないため）。
 */
function signalToPct(v?: "high" | "low" | "unknown"): number {
  if (v === "high") return 85;
  if (v === "low") return 25;
  return 50;
}

/**
 * 未処理タスク件数と残稼働時間から「作業が伸びる予測終了時刻」を求める。
 * 1タスク平均 45 分の素朴な見積もり。残時間を超えた分だけ 17:00 から後ろ倒し。
 */
function predictEndTime(
  now: Date,
  pendingTaskCount: number,
  avgTaskMinutes = 45,
): string {
  const needed = pendingTaskCount * avgTaskMinutes;
  const remaining = remainingWorkMinutes(now);
  const overflow = Math.max(0, needed - remaining);

  const end = new Date(now);
  end.setHours(17, 0, 0, 0);
  end.setMinutes(end.getMinutes() + overflow);

  const h = String(end.getHours()).padStart(2, "0");
  const m = String(end.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export interface HomeMetricsInput {
  now: Date;
  calendar: CalendarStatus;
  /** 直近の代表 proposal（psychSignals を持つもの）。無ければ null */
  proposal: Proposal | null;
  /** 未処理タスク（候補 + 承認済み未完了）件数 */
  pendingTaskCount: number;
  /**
   * スケジュールAPIのsaboriバンド合計分数。
   * 指定された場合は件数見積もりより優先して余白計算に使う。
   */
  scheduleSaboruMinutes?: number | null;
}

export function computeHomeMetrics(input: HomeMetricsInput): HomeMetrics {
  const { now, calendar, proposal, pendingTaskCount, scheduleSaboruMinutes } =
    input;
  const ps = proposal?.psychSignals;

  // --- カレンダー密度: busyScore(0-1) を主、freeSlot を従に算出 ---
  const busyScore = calendar.busyScore;
  let calendarDensityPct: number;
  if (typeof busyScore === "number") {
    calendarDensityPct = clampPct(busyScore * 100);
  } else if (typeof calendar.freeSlotMinutesToday === "number") {
    const used = TOTAL_WORK_MINUTES - calendar.freeSlotMinutesToday;
    calendarDensityPct = clampPct((used / TOTAL_WORK_MINUTES) * 100);
  } else {
    calendarDensityPct = 50; // フォールバック
  }

  // --- 即レス圧: 外部プレッシャー + 次会議圧 + 識別可能性の合成 ---
  const responsePressurePct = clampPct(
    signalToPct(ps?.externalPressureLevel) * 0.5 +
      signalToPct(ps?.nextMeetingPressure) * 0.25 +
      signalToPct(ps?.taskIdentifiability) * 0.25,
  );

  // --- 連続稼働: 経過稼働分（始業からの稼働、休憩除く） ---
  const continuousWorkMinutes = TOTAL_WORK_MINUTES - remainingWorkMinutes(now);

  // --- 文書のトゲ: 外部プレッシャーが high なら注意 ---
  const documentSharpness: SignalLevel =
    ps?.externalPressureLevel === "high"
      ? "high"
      : ps?.externalPressureLevel === "low"
        ? "low"
        : "mid";

  // --- 認知負荷スコア: 密度・即レス圧・稼働率・トゲの加重平均 ---
  const workRatioPct = clampPct(
    (continuousWorkMinutes / TOTAL_WORK_MINUTES) * 100,
  );
  const sharpnessPct = signalToPct(ps?.externalPressureLevel);
  const cognitiveLoadScore = clampPct(
    calendarDensityPct * 0.3 +
      responsePressurePct * 0.35 +
      workRatioPct * 0.2 +
      sharpnessPct * 0.15,
  );

  // --- 今日の余白: スケジュールAPIがあればそちらを優先、なければ件数見積もり ---
  // 終業後・始業前（深夜含む）は翌日/今日の全稼働時間を基準にする
  const h = now.getHours();
  const isAfterWork = h >= WORK_END_HOUR;
  const isBeforeWork = h < WORK_START_HOUR;
  const effectiveRemaining =
    isAfterWork || isBeforeWork ? TOTAL_WORK_MINUTES : remainingWorkMinutes(now);
  const taskLoad = pendingTaskCount * 45;
  const saboruMinutesToday =
    scheduleSaboruMinutes != null
      ? scheduleSaboruMinutes
      : Math.max(0, effectiveRemaining - taskLoad);

  const predictedEndTime = predictEndTime(now, pendingTaskCount);

  const comment =
    saboruMinutesToday >= 60
      ? "余裕があります。いま少しサボっても問題ありません。"
      : saboruMinutesToday > 0
        ? "少し詰まり気味。空き枠を先に確保できます。"
        : "予定密度と即レス圧が高く、余白が削られやすい状態です。";

  void levelLabel; // ラベルは UI 側で使う（再エクスポート用）

  return {
    saboruMinutesToday,
    cognitiveLoadScore,
    calendarDensityPct,
    responsePressurePct,
    continuousWorkMinutes,
    documentSharpness,
    predictedEndTime,
    comment,
  };
}

export { levelLabel };
