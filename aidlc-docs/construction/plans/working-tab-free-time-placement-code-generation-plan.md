# Working Tab Free Time Placement Code Generation Plan

## Metadata
- Unit: `working-tab-free-time-placement`
- Phase: Construction
- Stage: Code Generation
- Depth: Minimal
- Created: 2026-06-26T04:43:55Z

## Scope
Move the dynamic free-time session summary that was introduced in the free-time tab into the working tab, without changing backend APIs or the chat-side action flow.

## Execution Checklist
- [x] Step 1: Extract the reusable free-time session summary UI from `SlackTab`.
- [x] Step 2: Render the free-time session summary at the top of `WorkingTab`.
- [x] Step 3: Remove the always-visible free-time summary from `SlackTab` while keeping chat actions, progress reports, and recovery check behavior there.
- [x] Step 4: Update extension tests so dynamic free-time status is asserted in the working tab.
- [x] Step 5: Run focused extension tests, typecheck, build, and formatting checks.

## Security Compliance
| Extension | Status | Rationale |
|---|---|---|
| Security Baseline | Compliant | UI placement only. No new endpoint, storage, permissions, external network path, secret handling, or authentication boundary change. |
| Property-Based Testing | N/A | Disabled in `aidlc-state.md`; deterministic UI tests cover the behavior. |
