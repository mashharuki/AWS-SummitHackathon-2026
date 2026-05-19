/**
 * Shared enumeration types for Saboru application
 * Q2, Q3, Q9 answers confirmed 2026-05-17
 */

/** Sabori verdict (Q2 answer) */
export type Verdict = "can_saboru" | "borderline" | "must_do";
// 'can_saboru': Can take a break now
// 'borderline': Gray zone
// 'must_do': Must do it or it'll be bad

/** Quick reply type (Q3 answer) */
export type QuickReplyType =
  | "truly_tired"
  | "actually_important"
  | "agree_with_ai"
  | "disagree_with_ai";
// 'truly_tired': "Indeed, let it sit a bit more"
// 'actually_important': "No, this task should be done sooner"
// 'agree_with_ai': "Do it for 15 minutes" (partially agree with AI judgment)
// 'disagree_with_ai': "Want to completely ignore it" (deny AI judgment)

/** Data source type */
export type SourceType = "slack" | "manual";

/** External service type */
export type ServiceType = "slack";

/** External service connection status */
export type ConnectionStatus = "connected" | "disconnected" | "token_expired";

/** Task candidate lifecycle (Q1 answer) */
export type TaskCandidateStatus = "pending" | "approved" | "rejected";

/** Approved task status */
export type TaskStatus = "approved" | "deleted";

/** Honne reaction type */
export type HonneType = "quick_reply" | "free_text";

/** Persona type (Q9 answer) */
export type PersonaType = "saboru" | "amayakashi";
// 'saboru': Ottori Saboru (MVP use)
// 'amayakashi': Amayakashi Saboru (future vision)
