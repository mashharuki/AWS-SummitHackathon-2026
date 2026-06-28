# tts-normalizer-enhancement Requirements

## Intent Analysis

- **Request type**: Enhancement
- **Scope**: Backend utility and proposal route integration
- **Complexity**: Simple to moderate
- **Risk**: Low, isolated to text normalization before TTS output

## Functional Requirements

- `normalizeForTts` must keep its public function name and accept normal utterance text as well as JSON-formatted strings.
- Existing abbreviation conversion behavior for terms such as `AWS`, `API`, and `URL` must remain.
- Project-specific technical terms must be converted to stable Japanese readings, including AWS service names, ElevenLabs, Slack, Chrome, TypeScript, GitHub, Hono, Vitest, Biome, AWS Summit Japan 2026, Summit, Hackathon, and SABOROU.
- Date strings in `YYYY-MM-DD` format must become `YYYY年M月D日`.
- Time strings in `HH:mm` format must become `H時mm分`.
- Only confirmed counter patterns should be converted for v1, including 個, 件, 人, 分, and 時間.
- URL-like strings must not remain as long readout text and should be shortened to `リンク`.
- JSON object keys such as `taskId`, `channelId`, and `threadTs` must not be modified.
- Slack timestamps and ID-like values should be simplified when they appear as values or natural text, not when they are JSON keys.
- Proposal `ttsSummary` must be normalized before final truncation and remain around 100 characters.

## Non-Functional Requirements

- No external Japanese morphological analysis dependency is added in v1.
- The implementation must be deterministic and testable as a pure utility.
- The implementation must not log or expose sensitive values.
- The implementation must preserve existing MCP JSON-RPC integration.

## Extension Compliance

- **Security Baseline**: Applicable. No new storage, network endpoint, IAM permission, or secret handling is introduced. SECURITY-03/05/08 remain covered by existing route boundaries; this change only transforms response text.
- **Property-Based Testing**: Disabled in `aidlc-docs/aidlc-state.md`; skipped.

