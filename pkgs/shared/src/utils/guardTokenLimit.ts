/**
 * Default token limit (Q8 answer)
 * Overridable via environment variable MAX_TOKEN_LIMIT
 */
export const DEFAULT_MAX_TOKEN_LIMIT = 8000;

/**
 * Calculate approximate token count for text
 *
 * Estimation rules:
 * - Japanese characters (hiragana, katakana, kanji, full-width symbols):
 *   1 char ≈ 1.5 tokens
 * - Other characters (ASCII, numbers, etc.):
 *   1 char ≈ 0.25 tokens
 *
 * Business rule (BR-12):
 * - Used for Bedrock cost pre-flight check
 *
 * @param text Text to calculate token count
 * @returns Approximate token count
 */
export function countTokens(text: string): number {
  // Detect Japanese characters (hiragana, katakana, kanji, full-width symbols)
  // Unicode ranges: CJK Unified Ideographs, Hiragana, Katakana, Full-width forms
  const japaneseCharCount = (text.match(/[　-鿿＀-￯]/g) ?? []).length;
  const otherCharCount = text.length - japaneseCharCount;
  return Math.ceil(japaneseCharCount * 1.5 + otherCharCount * 0.25);
}

/**
 * Truncate text to fit within specified token limit
 * Preflight guard before Bedrock converse API call (NFR-01, NFR-06)
 *
 * Uses binary search to efficiently find truncation point.
 *
 * Business rules:
 * - SaboriProposerAgent / TaskExtractorAgent MUST run guardTokenLimit()
 *   before Bedrock call (BR-07)
 * - If MAX_TOKEN_LIMIT env var is not set, use DEFAULT_MAX_TOKEN_LIMIT = 8000 (BR-12)
 * - Whether to throw BedrockCostExceededError when limit is exceeded is
 *   determined by the caller (Agent side)
 *
 * @param prompt Prompt to send to Bedrock
 * @param limit Token limit (default: DEFAULT_MAX_TOKEN_LIMIT or env var)
 * @returns Prompt trimmed to fit within token limit
 */
export function guardTokenLimit(prompt: string, limit?: number): string {
  const effectiveLimit =
    limit ??
    (process.env["MAX_TOKEN_LIMIT"]
      ? Number.parseInt(process.env["MAX_TOKEN_LIMIT"], 10)
      : DEFAULT_MAX_TOKEN_LIMIT);

  if (countTokens(prompt) <= effectiveLimit) {
    return prompt;
  }

  // Binary search to find truncation point
  let low = 0;
  let high = prompt.length;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (countTokens(prompt.slice(0, mid)) <= effectiveLimit) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return prompt.slice(0, low);
}
