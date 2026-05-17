import { ulid } from "ulidx";

/**
 * Generate ULID (Universally Unique Lexicographically Sortable Identifier)
 * Used as time-sortable unique ID for DynamoDB SK
 *
 * Q4 answer: using ulidx npm package
 * Reason: compatible with both browser/Node.js environments,
 *         based on crypto.getRandomValues()
 *
 * Usage:
 * - TaskCandidate creation: SK = TASK_CAND#<ulid>
 * - Task creation: SK = TASK#<ulid>
 *
 * Business rules:
 * - Always generate SK with generateUlid() when creating TaskCandidate
 * - When converting TaskCandidate to Task, generate a NEW ULID (BR-04)
 * - ULID is uppercase Crockford's Base32 format (26 characters)
 *
 * @returns ULID string (26 characters)
 */
export function generateUlid(): string {
  return ulid();
}
