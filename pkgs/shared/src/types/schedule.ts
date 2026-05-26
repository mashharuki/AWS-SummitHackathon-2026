import { z } from "zod";

/**
 * スケジュール（3バンドガント）関連の型とスキーマ
 *
 * SABOROU のコア機能「段取り逆算」の出力。
 * AI エージェントがタスクを作業ステップに分解し、Google Calendar の予定を
 * 避けつつ時間軸に配置する。ステップ間の空き時間が「さぼろう」帯になる。
 *
 * 設計方針:
 * - SaboriSchedule は揮発データ（DynamoDB に保存しない）。
 *   生成のたびに「今この瞬間のカレンダー状況」に基づいて再計算する。
 * - カレンダーの予定タイトルは保持しない（PII 保護 / DP-04 踏襲）。
 *   時間区間（busy slot）のみを使い、レスポンス後に破棄する。
 * - API 入出力で実行時バリデーションするため Zod スキーマを主とし、
 *   型は z.infer で導出する。
 */

// ───────────────────────────────────────────
// BandType — ガントの 3 バンド種別
// ───────────────────────────────────────────

/**
 * ガントチャートのバンド種別
 * - saboru:   「さぼろう」区間（緑）。ステップ間の空き時間に決定論的に算出される
 * - work:     実際の作業区間（白枠）
 * - decision: 意思決定が必要な区間（黄）
 * - busy:     カレンダー予定で埋まっている区間（グレー）。作業もサボりもできない
 */
export const BandTypeSchema = z.enum(["saboru", "work", "decision", "busy"]);
export type BandType = z.infer<typeof BandTypeSchema>;

// ───────────────────────────────────────────
// ScheduleStep — AI が分解した作業ステップ（LLM 入出力 / 承認時の確定値）
// ───────────────────────────────────────────

/**
 * ScheduleStep — タスクを構成する 1 作業ステップ
 *
 * 用途:
 * - SchedulePlannerAgent が Bedrock（plan_schedule Tool）から受け取る出力の 1 要素
 * - 承認モーダルでユーザーが確認・編集し、確定したものを Task.plannedSteps に保存
 * - ガント生成時、Task.plannedSteps があれば Bedrock 再呼び出しを省略してそのまま配置
 *
 * 所有権メモ（R-5）:
 * この型は agent / backend / frontend が共通で使うため shared が所有する。
 * agent 側（plan_schedule Tool）は本スキーマを re-import する。
 *
 * 注意: saboru / busy はステップには含めない。
 * - saboru: ステップ間の空き時間から呼び出し元が決定論的に算出する
 * - busy:   カレンダー予定由来であり作業ステップではない
 */
export const ScheduleStepSchema = z.object({
  /** ステップ ID（s1, s2, ... の形式。最大30文字） */
  stepId: z.string().min(1).max(30),
  /** ステップ表示名（最大60文字。例:「議事録を文字起こし」） */
  stepLabel: z.string().min(1).max(60),
  /** 所要時間（分、5〜480） */
  durationMinutes: z.number().int().min(5).max(480),
  /** バンド種別。work=手を動かす作業 / decision=判断・確認が必要な工程 */
  bandType: z.enum(["work", "decision"]),
  /** このステップが必要な理由（任意、最大200文字） */
  rationale: z.string().max(200).optional(),
});
export type ScheduleStep = z.infer<typeof ScheduleStepSchema>;

// ───────────────────────────────────────────
// BusySlot — カレンダー予定の時間区間（揮発・PII フリー）
// ───────────────────────────────────────────

/**
 * BusySlot — Google Calendar の予定が占有する時間区間
 *
 * 予定タイトル・説明は含めない（PII 保護）。開始・終了時刻のみ。
 * スケジュール生成時にその場で取得し、レスポンス後に破棄する（永続化しない）。
 */
export const BusySlotSchema = z.object({
  /** 予定開始時刻 ISO 8601 */
  startAt: z.string().datetime(),
  /** 予定終了時刻 ISO 8601 */
  endAt: z.string().datetime(),
  /**
   * 予定名（任意・表示用）。ガント上の busy ブロックに表示する。
   * 揮発データとしてのみ扱い、DynamoDB には永続化しない。
   */
  title: z.string().optional(),
});
export type BusySlot = z.infer<typeof BusySlotSchema>;

// ───────────────────────────────────────────
// ScheduleBlock — ガントの 1 バンド
// ───────────────────────────────────────────

/**
 * ScheduleBlock — ガントの 1 バンド（1 ステップ行 × 1 時間区間）
 *
 * work/decision ブロックは AI が分解したステップ。
 * saboru ブロックはステップ間の空き時間から決定論的に算出される。
 */
export const ScheduleBlockSchema = z.object({
  /** ステップ ID（行の識別子） */
  stepId: z.string().min(1).max(40),
  /** ステップ表示名（例:「議事録を文字起こし」「さぼろう」） */
  stepLabel: z.string().min(1).max(80),
  /** バンド種別 */
  bandType: BandTypeSchema,
  /** 開始時刻 ISO 8601 */
  startAt: z.string().datetime(),
  /** 終了時刻 ISO 8601 */
  endAt: z.string().datetime(),
  /** 所要時間（分） */
  durationMinutes: z.number().int().positive(),
  /** 根拠テキスト（任意・表示用）。saboru 帯では省略 */
  rationale: z.string().max(200).optional(),
});
export type ScheduleBlock = z.infer<typeof ScheduleBlockSchema>;

// ───────────────────────────────────────────
// SaboriSchedule — スケジュールAPIのレスポンス本体
// ───────────────────────────────────────────

/**
 * SaboriSchedule — GET /api/tasks/:id/schedule のレスポンス本体
 *
 * DynamoDB には保存しない揮発データ。ガント描画とゲームスコア連動に使う。
 */
export const SaboriScheduleSchema = z.object({
  /** タスク ID */
  taskId: z.string().min(1),
  /** スケジュール生成日時 ISO 8601 */
  generatedAt: z.string().datetime(),
  /** ガント表示の左端（グリッド開始）ISO 8601 */
  viewStartAt: z.string().datetime(),
  /** ガント表示の右端（グリッド終了）ISO 8601 */
  viewEndAt: z.string().datetime(),
  /** タスク締切 ISO 8601 / 不明時 null */
  deadline: z.string().datetime().nullable(),
  /** ブロック一覧（ガント行）。最低 1 件 */
  blocks: z.array(ScheduleBlockSchema).min(1),
  /** 「さぼろう」合計時間（分）— 決定論的に算出 */
  totalSaboruMinutes: z.number().int().nonnegative(),
  /** カレンダー時間区間を使用したか（false=未連携やダミー） */
  calendarUsed: z.boolean(),
});
export type SaboriSchedule = z.infer<typeof SaboriScheduleSchema>;

/**
 * スケジュールAPI レスポンスのラッパー
 */
export const ScheduleApiResponseSchema = z.object({
  schedule: SaboriScheduleSchema,
});
export type ScheduleApiResponse = z.infer<typeof ScheduleApiResponseSchema>;
