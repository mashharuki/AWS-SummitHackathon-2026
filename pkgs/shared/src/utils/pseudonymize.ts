import { createHash } from "crypto";
import { AppError } from "../errors/AppError";

/**
 * Pseudonymize requester name with SHA-256 hash (NFR-07 privacy protection)
 *
 * Q5 answer: SHA-256 hashing, Node.js crypto standard module
 *
 * Design policy:
 * - Pseudonymize requester (user_id / display_name) from Slack messages
 *   before storing in DynamoDB
 * - Hash is irreversible. Original name is never stored in DynamoDB.
 * - Salt is retrieved from environment variable PSEUDONYMIZE_SALT
 *   (throws error if not set)
 *
 * Business rules:
 * - TaskCandidate.requester and Task.requester MUST go through pseudonymize()
 *   before saving (BR-05)
 * - Slack API user_id or username must NOT be written directly to DynamoDB
 * - PSEUDONYMIZE_SALT is managed via AWS Systems Manager Parameter Store
 *   or Secrets Manager (aws-constraints.md, BR-06)
 *
 * @param name Original requester name or Slack user_id
 * @returns SHA-256 hash value (hex, 64 characters)
 * @throws AppError('INVALID_INPUT') if salt is not configured
 */
export function pseudonymize(name: string): string {
  const salt = process.env["PSEUDONYMIZE_SALT"];
  if (!salt) {
    throw new AppError(
      "INVALID_INPUT",
      "PSEUDONYMIZE_SALT environment variable is required",
      500,
    );
  }
  return createHash("sha256")
    .update(salt + name)
    .digest("hex");
}
