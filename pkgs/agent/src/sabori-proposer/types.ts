import type { Proposal, Task, Verdict } from "@saboru/shared";

/**
 * U-03b: sabori-proposer internal type definitions
 *
 * These types are agent-internal and NOT exported from @saboru/shared.
 * External-facing types (Proposal, Verdict, Task) are imported from @saboru/shared.
 */

/**
 * TaskContext — Input to SaboriProposerAgent
 * Combines task data with optional Slack enrichment
 */
export interface TaskContext {
  task: Task;
  slackContext?: SlackContext;
}

/**
 * SlackContext — Collected by ContextCollector (U-03a)
 * NFR-S1: rawSummary is deleted immediately after processing (never persisted)
 */
export interface SlackContext {
  requesterStatus: "online" | "away" | "offline" | "unknown";
  lastActivityAt?: string;
  reminderCount: number;
  urgencyKeywords: string[];
  threadActive: boolean;
  /** Slack message summary text — deleted after Phase 1 processing (NFR-07) */
  rawSummary: string;
}

/**
 * LLMJudgment — Phase 2 Bedrock Tool Use structured output (intermediate type)
 * Parsed from sabori_judgment tool response before PersonaRenderer transforms it
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
