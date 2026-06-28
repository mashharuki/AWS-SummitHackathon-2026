# tts-normalizer-enhancement Code Generation Summary

## Summary

Enhanced backend TTS normalization from a flat acronym replacement table into a staged normalization pipeline used by ElevenLabs-facing text.

## Modified Application Code

- `pkgs/backend/src/utils/ttsNormalizer.ts`
  - Preserves `normalizeForTts` as the public entry point.
  - Parses JSON input and normalizes string values without changing keys such as `taskId`, `channelId`, and `threadTs`.
  - Normalizes project and technical terms, dates, times, selected counters, URLs, Slack timestamps, IDs, priority labels, and status labels.
- `pkgs/backend/src/routes/proposals.ts`
  - Applies `normalizeForTts` to `ttsSummary` before final 100-character truncation.
- `pkgs/backend/src/__tests__/routes/mcp-jsonrpc.test.ts`
  - Updates expected MCP TTS output for normalized `Slack` reading.
- `pkgs/backend/src/__tests__/routes/proposals.test.ts`
  - Adds `ttsSummary` normalization coverage and keeps length-bound coverage.

## Created Tests

- `pkgs/backend/src/__tests__/utils/ttsNormalizer.test.ts`
  - Covers existing abbreviation preservation.
  - Covers JSON key preservation.
  - Covers counters, dates, times, URLs, project terms, statuses, and priorities.

## Verification

- `pnpm --filter backend test` passed: 48 test files, 480 tests.
- `pnpm --filter backend build` passed.
- `pnpm --filter backend typecheck` passed.

## Notes

- Backend build still emits pre-existing esbuild duplicate-key warnings from `../agent/dist/index.mjs`.
- No new dependencies, endpoints, infrastructure, IAM permissions, storage, or secret handling were added.

