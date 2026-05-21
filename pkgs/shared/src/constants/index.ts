/**
 * Verdict (sabori judgment) constants
 * Q2 answer: 3 values
 */
export const VERDICT_TYPE = {
  CAN_SABORU: "can_saboru",
  BORDERLINE: "borderline",
  MUST_DO: "must_do",
} as const;

/**
 * Data source type constants
 */
export const SOURCE_TYPE = {
  SLACK: "slack",
  MANUAL: "manual",
} as const;

/**
 * External service type constants
 */
export const SERVICE_TYPE = {
  SLACK: "slack",
} as const;

/**
 * Quick reply type constants (FR-05)
 * Q3 answer: 4 values
 */
export const QUICK_REPLY_TYPE = {
  TRULY_TIRED: "truly_tired",
  ACTUALLY_IMPORTANT: "actually_important",
  AGREE_WITH_AI: "agree_with_ai",
  DISAGREE_WITH_AI: "disagree_with_ai",
} as const;

/**
 * Default token limit (Q8 answer)
 * Overridable via environment variable MAX_TOKEN_LIMIT
 */
export const DEFAULT_MAX_TOKEN_LIMIT = 8000;

/**
 * DynamoDB SK prefix definitions
 * Used for consistent PK/SK construction
 */
export const DDB_PREFIX = {
  USER: "USER#",
  TASK_CAND: "TASK_CAND#",
  TASK: "TASK#",
  CONN: "CONN#",
  PERSONA: "PERSONA#",
  PROPOSAL: "PROPOSAL#",
  HONNE: "HONNE#",
} as const;

/** MVP fixed persona ID */
export const DEFAULT_PERSONA_ID = "saboru_ottori";

/** TaskCandidate TTL days (DynamoDB auto-delete, BR-13) */
export const TASK_CANDIDATE_TTL_DAYS = 30;

/** Task candidate lifecycle status constants */
export const TASK_CANDIDATE_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

/** Task status constants */
export const TASK_STATUS = {
  APPROVED: "approved",
  DELETED: "deleted",
} as const;
