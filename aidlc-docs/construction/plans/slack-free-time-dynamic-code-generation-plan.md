# Slack Free Time Dynamic Code Generation Plan

## Metadata
- Unit: `slack-free-time-dynamic`
- Phase: Construction
- Stage: Code Generation
- Depth: Minimal
- Created: 2026-06-26T03:18:43Z

## Scope
Replace the Slack/free-time tab demo constants with a dynamic composition of existing APIs:
- `GET /api/tasks`
- `GET /api/tasks/:taskId/decompose`
- `POST /api/tasks/:taskId/decompose`
- `POST /api/tasks/:taskId/report`
- existing recovery check runtime messages

No new backend API is introduced.

## Execution Checklist
- [x] Step 1: Resolve active task from delegated task ID or first task.
- [x] Step 2: Resolve next task from future task deadlines, excluding the active task.
- [x] Step 3: Prefer existing `goalAnalysis`; otherwise call `getGoalAnalysis`, then `decomposeTask` as fallback.
- [x] Step 4: Build Slack tab status, initial message, chat replies, and recovery-check scheduling from `FreeTimeSession`.
- [x] Step 5: Generate progress reports through `getProgressReport` and keep local text as fallback.
- [x] Step 6: Keep extension agent client on Hono APIs and avoid direct `/mcp/tools/` calls.
- [x] Step 7: Add JSON-RPC tests for `saborou_suggest_free_time` against the existing decompose GET API.
- [x] Step 8: Run focused extension/backend verification and formatting checks.

## Security Compliance
| Extension | Status | Rationale |
|---|---|---|
| Security Baseline | Compliant | No new endpoint, IAM policy, storage, or secret path. Existing JWT-authenticated Hono API boundary is preserved. MCP calls continue through allowlisted registry and internal caller with safe JSON-RPC error mapping. |
| Property-Based Testing | N/A | Disabled in `aidlc-state.md`; this change is UI/API composition and deterministic integration testing covers the behavior. |

