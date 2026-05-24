import type { Verdict } from "./enums";

/** Psychological signal level */
export type SignalLevel = "high" | "low" | "unknown";

/** Real psychological signals derived from task context (not hardcoded) */
export interface PsychSignals {
  /** Identifiability (Williams et al., 1981): can requester see contribution? */
  taskIdentifiability: SignalLevel;
  /** Expectancy Theory (Vroom, 1964): effort-outcome expectancy by deadline */
  effortOutcomeExpectancy: SignalLevel;
  /** Sucker Effect (Kerr, 1983): perceived peer effort level */
  perceivedPeerEffort: SignalLevel;
  /** SDT (Ryan & Deci, 2000): external pressure from reminders/urgency */
  externalPressureLevel: SignalLevel;
}

/**
 * Proposal entity (sabori proposal log)
 * DynamoDB: Proposals table
 * PK: TASK#<taskId>
 * SK: PROPOSAL#<ISO8601>
 *
 * Sabori judgment history log.
 * Latest proposal retrieved efficiently via GSI-TaskLatest.
 */
export interface Proposal {
  /** DynamoDB PK: TASK#<taskId> */
  PK: string;
  /** DynamoDB SK: PROPOSAL#<ISO8601> */
  SK: string;
  /** Task ID (for GSI) */
  taskId: string;
  /** User ID */
  userId: string;
  /** Sabori verdict (Q2 answer) */
  verdict: Verdict;
  /** One-line summary text (for task list screen) */
  summaryText: string;
  /** Reasoning materials (bullet points, max 10 items) */
  reasoning: string[];
  /** Saboru chat message (tone-converted) */
  chatMessage: string;
  /** Used persona ID (MVP: 'saboru_ottori' fixed) */
  personaId: string;
  /** Evaluation datetime (ISO 8601) */
  evaluatedAt: string;
  /** Next re-evaluation timing (ISO 8601) */
  nextCheckAt: string;
  /** Token count used (for cost tracking) */
  tokenCount: number;
  /** Real psychological signals derived from task context at judgment time */
  psychSignals?: PsychSignals;
}
