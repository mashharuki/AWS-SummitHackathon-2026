# Working Tab Free Time Placement Code Generation Summary

## Summary
The dynamic free-time session summary now appears in the working tab instead of the free-time chat tab. The chat tab keeps the conversation, progress report ticket, video continuation ticket, next-task preparation flow, and recovery check scheduling behavior.

## Code Changes
- Added `FreeTimeSessionPanel` as a reusable UI component for the next-task status card and free-time suggestion message.
- Updated `WorkingTab` to render `FreeTimeSessionPanel` at the top of the tab.
- Removed the always-visible free-time summary from `SlackTab`.
- Updated extension tests to assert dynamic free-time display in the working tab and absence from the free-time chat tab.

## Verification
- `pnpm --filter @saboru/extension test` passed: 14 files, 214 tests.
- `pnpm --filter @saboru/extension typecheck` passed.
- `pnpm --filter @saboru/extension build` passed.
- `pnpm exec biome check pkgs/extension/src/panel/components/FreeTimeSessionPanel.tsx pkgs/extension/src/panel/tabs/SlackTab.tsx pkgs/extension/src/panel/tabs/WorkingTab.tsx pkgs/extension/src/panel/App.test.tsx` passed.

## Security Compliance
- Security Baseline: Compliant. This is a frontend placement change only.
- Property-Based Testing: N/A. Disabled in state and not applicable to this deterministic UI placement.
