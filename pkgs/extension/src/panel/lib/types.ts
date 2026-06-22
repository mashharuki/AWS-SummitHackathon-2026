/**
 * 拡張パネルが扱う API レスポンス型。
 *
 * shared パッケージへ依存させず（拡張は @/* のみ参照する方針）、
 * 必要なフィールドだけを拡張内に定義する。バックエンドの shared 型
 * （pkgs/shared/src/types）の部分集合であり、互換性を保つ。
 */

/** サボり判定 verdict（shared/types/proposal.ts と同一値） */
export type Verdict = "can_saboru" | "borderline" | "must_do";

/** バンド種別（shared/types/schedule.ts と同一値） */
export type BandType = "saboru" | "work" | "decision" | "busy";

/** 承認済みタスク（GET /api/tasks の要素・部分集合） */
export interface TaskSummary {
  taskId: string;
  title: string;
  status: string;
  deadline?: string | null;
  description?: string;
  requester?: string;
  assignee?: string;
  slackChannelId?: string;
  plannedSteps?: ScheduleStep[];
}

/** タスク候補（GET /api/tasks/candidates の要素・部分集合） */
export interface TaskCandidate {
  candidateId: string;
  title: string;
  deadline: string | null;
  requester: string;
  assignee?: string;
  description: string;
  sourceType: string;
  slackChannelId?: string;
  /** スレッド ts（Slack 候補のみ。返信先解決に使う） */
  threadTs?: string;
  /** フロント側で付与する検知時刻（ISO8601）。表示フィルタに使う */
  detectedAt?: string;
}

/** 作業ステップ（承認モーダルで編集する草案） */
export interface ScheduleStep {
  stepId: string;
  stepLabel: string;
  durationMinutes: number;
  bandType: "work" | "decision";
  decisionAt?: string;
  anchorAt?: string;
  rationale?: string;
}

/** ガント描画ブロック（GET /api/tasks/:id/schedule の blocks 要素） */
export interface ScheduleBlock {
  stepId: string;
  stepLabel: string;
  bandType: BandType;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  rationale?: string;
}

/** 3バンドガント（GET /api/tasks/:id/schedule のレスポンス schedule） */
export interface SaboriSchedule {
  taskId: string;
  generatedAt: string;
  viewStartAt: string;
  viewEndAt: string;
  deadline: string | null;
  blocks: ScheduleBlock[];
  totalSaboruMinutes: number;
  calendarUsed: boolean;
}

/** 心理学シグナル（Proposal.psychSignals・部分集合） */
export interface PsychSignals {
  taskIdentifiability?: "high" | "low" | "unknown";
  effortOutcomeExpectancy?: "high" | "low" | "unknown";
  perceivedPeerEffort?: "high" | "low" | "unknown";
  externalPressureLevel?: "high" | "low" | "unknown";
  calendarBusyness?: "high" | "low" | "unknown";
  nextMeetingPressure?: "high" | "low" | "unknown";
}

/** サボり提案（GET /api/tasks/:id/proposal・部分集合） */
export interface Proposal {
  taskId: string;
  verdict: Verdict;
  summaryText: string;
  reasoning: string[];
  chatMessage: string;
  evaluatedAt?: string;
  nextCheckAt?: string;
  psychSignals?: PsychSignals;
}

/** Google Calendar キャッシュ状態（GET /api/google/calendar/status） */
export interface CalendarStatus {
  cached: boolean;
  valid?: boolean;
  fetchedAt?: string;
  upcomingEventCount?: number;
  nextEventStartsInMinutes?: number | null;
  freeSlotMinutesToday?: number;
  busyScore?: number;
}

/** 進捗報告（POST /api/tasks/:id/report） */
export interface ProgressReport {
  taskId: string;
  reportText: string;
  tone?: string;
  reasoning: string;
}
