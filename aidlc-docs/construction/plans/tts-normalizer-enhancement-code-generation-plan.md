# tts-normalizer-enhancement Code Generation Plan

## Unit Context

- **Unit name**: `tts-normalizer-enhancement`
- **Workspace root**: `/Users/harukikondo/git/AWS-SummitHackathon-2026`
- **Application code location**: `pkgs/backend/src/`
- **Documentation location**: `aidlc-docs/construction/tts-normalizer-enhancement/code/`
- **Dependencies**: Existing backend Vitest setup and proposal route tests

## Plan Steps

- [x] Step 1: Expand `pkgs/backend/src/utils/ttsNormalizer.ts` into a staged normalization pipeline.
- [x] Step 2: Add `pkgs/backend/src/__tests__/utils/ttsNormalizer.test.ts` for abbreviations, JSON key preservation, counters, dates, times, URLs, IDs, Slack timestamps, statuses, and project terms.
- [x] Step 3: Apply `normalizeForTts` to `ttsSummary` generation in `pkgs/backend/src/routes/proposals.ts` after drafting and before final truncation.
- [x] Step 4: Update proposal route tests to verify normalized `ttsSummary` and 100-character bound.
- [x] Step 5: Run focused backend tests for the new utility and proposal route.
- [x] Step 6: Run broader backend verification as time permits.
- [x] Step 7: Write the code generation summary in `aidlc-docs/construction/tts-normalizer-enhancement/code/code-generation-summary.md`.

## Security Compliance

- No new data store, endpoint, authorization path, IAM policy, or secret handling is introduced.
- URL/ID shortening is output-only and does not log or persist sensitive values.
