import type { Proposal, Task, Verdict } from "@saboru/shared";

/**
 * U-03b: sabori-proposer 内部型定義
 *
 * これらの型はエージェント内部用であり、@saboru/shared からはエクスポートしない。
 * 外部向け型 (Proposal, Verdict, Task) は @saboru/shared からインポートする。
 */

/**
 * TaskContext — SaboriProposerAgent への入力
 * タスクデータとオプションの Slack エンリッチメントを組み合わせる
 */
export interface TaskContext {
  task: Task;
  slackContext?: SlackContext;
}

/**
 * SlackContext — ContextCollector (U-03a) が収集する
 * NFR-S1: rawSummary は処理後に即座に削除 (永続化しない)
 */
export interface SlackContext {
  requesterStatus: "online" | "away" | "offline" | "unknown";
  lastActivityAt?: string;
  reminderCount: number;
  urgencyKeywords: string[];
  threadActive: boolean;
  /** Slack メッセージ要約テキスト — フェーズ 1 処理後に削除 (NFR-07) */
  rawSummary: string;
}

/**
 * LLMJudgment — フェーズ 2 Bedrock Tool Use 構造化出力 (中間型)
 * PersonaRenderer が変換する前に sabori_judgment ツールレスポンスから解析される
 */
export interface LLMJudgment {
  verdict: Verdict;
  summaryText: string;
  reasoning: string[];
  rawChatMessage: string;
  nextCheckOffsetMinutes: number;
  appliedFramework?: string[];
}

/**
 * ContextSignals — Debug and audit signal record
 * Derived from TaskContext in Phase 1; stored with proposal for traceability
 */
export interface ContextSignals {
  hasReminder: boolean;
  reminderCount: number;
  requesterActiveStatus: string;
  nearestMeetingMinutes?: number;
  hasUrgentKeyword: boolean;
  deadlineMinutes?: number;
  contextCoverage: "full" | "partial" | "minimal";
  psychSignals?: {
    /** Identifiability (Williams et al., 1981): high if requester is online */
    taskIdentifiability: "high" | "low" | "unknown";
    /** Expectancy Theory (Vroom, 1964): based on deadline proximity */
    effortOutcomeExpectancy: "high" | "low" | "unknown";
    /** Sucker Effect (Kerr, 1983): perceived peer effort level */
    perceivedPeerEffort: "high" | "low" | "unknown";
    /** SDT (Ryan & Deci, 2000): external pressure from reminders/urgency */
    externalPressureLevel: "high" | "low" | "unknown";
  };
}

/**
 * ProposalDelta — SSE streaming diff type for proposeStream()
 * Each delta is yielded as an AsyncIterator event
 */
export interface ProposalDelta {
  type: "verdict" | "reasoning_item" | "chat_message_chunk" | "complete";
  payload: string | Partial<Proposal>;
}

/**
 * RenderInput — PersonaRenderer input
 * LLM raw output passed to Haiku for tone conversion
 */
export interface RenderInput {
  verdict: Verdict;
  reasoning: string[];
  summaryText: string;
  rawChatMessage: string;
  personaId: string;
}

/**
 * RenderOutput — PersonaRenderer output
 * Tone-converted content ready for Proposal assembly
 */
export interface RenderOutput {
  summaryText: string;
  chatMessage: string;
  verdictEmoji: string;
  verdictLabel: string;
  personaId: string;
}
