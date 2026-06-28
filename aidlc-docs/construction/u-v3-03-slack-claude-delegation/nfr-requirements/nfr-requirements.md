# U-V3-03 NFR Requirements: slack-claude-delegation

## Purpose
Define non-functional requirements for safely posting an approved Slack `@Claude` delegation message for a caller-owned task.

## NFR-SD-S1: Authentication And Authorization
The delegation operation must require authenticated user context and object-level task ownership.

Requirements:
- Direct Hono API calls must use existing `authMiddleware`.
- MCP calls must use the U-V3-01 verified identity path.
- `userId` must never be accepted from request body.
- Task lookup must use `taskRepository.findById(userId, taskId)`.
- Missing or wrong-owner task must not reveal cross-user existence.

Security Baseline:
- SECURITY-08 applicable and blocking.

## NFR-SD-S2: Explicit Side-Effect Approval
Slack delegation must not post without explicit approval metadata.

Requirements:
- `approved: true` is required for route and MCP dispatch.
- Approval must be checked before task lookup, Slack token lookup, and Slack API call where practical.
- Missing approval must return safe `FORBIDDEN`.
- Tests must prove no Slack client call occurs without approval.

Security Baseline:
- SECURITY-08 applicable and blocking.

## NFR-SD-S3: Input Validation
All request fields must be schema-validated before business execution.

Requirements:
- `taskId`: non-empty, bounded safe id string.
- `channelId`: non-empty, bounded Slack channel/DM id string.
- `threadTs`: optional, bounded Slack timestamp string.
- `instruction`: optional, bounded text.
- `approved`: boolean and true for side-effect execution.
- Unknown fields should be rejected or ignored consistently with existing route validation patterns.

Security Baseline:
- SECURITY-05 applicable and blocking.

## NFR-SD-S4: Secret And Credential Handling
Slack bot tokens and AWS/Secrets Manager internals must remain confidential.

Requirements:
- Reuse existing `getSlackToken(userId)` and `SlackClient`.
- Do not log token values, Authorization headers, or raw secret errors.
- Safe response bodies must not include tokens or internal secret names.
- Unit tests must cover Slack failure masking.

Security Baseline:
- SECURITY-03, SECURITY-09, and SECURITY-12 applicable and blocking.

## NFR-SD-S5: Safe Logging And Auditability
Every delegation attempt must be observable through safe structured metadata.

Requirements:
- Include request id, action/tool name, status, duration, and safe user/task identifiers.
- Hash or omit raw user id and task id in production audit events.
- Do not log full delegated text, instruction, task description, or Slack token.
- Existing MCP audit style should be reused or mirrored.

Security Baseline:
- SECURITY-03 applicable and blocking.

## NFR-SD-S6: Safe Error Handling
Errors must be useful for voice/UI recovery without exposing internals.

Requirements:
- Validation failure returns safe validation error.
- No approval returns safe forbidden error.
- Task missing/wrong-owner returns safe not-found error.
- Slack API failure returns safe `SLACK_API_ERROR`.
- Unexpected failure returns safe generic tool/server error.
- No stack trace, framework path, token, or raw Slack response body in user-visible output.

Security Baseline:
- SECURITY-09 applicable and blocking.

## NFR-SD-P1: Performance
Delegation is user-triggered and should complete within a short interactive latency budget.

Requirements:
- Message building must be synchronous and local.
- No Bedrock/LLM call is required in U-V3-03.
- Expected backend processing before Slack API call should be under 300 ms in tests/mocks.
- End-to-end latency depends on Slack API; target under 3 seconds for successful Slack post in normal conditions.

## NFR-SD-R1: Reliability And Failure Isolation
Delegation failure must not affect existing Slack reply, task, or MCP registry behavior.

Requirements:
- Existing `/api/slack/reply` behavior must remain compatible.
- Slack failure must not mutate SABOROU task state.
- Missing Slack connection/token should fail safely.
- U-V3-02 registry and OpenAPI drift tests must continue passing after implementing delegation.

## NFR-SD-R2: Idempotency And Duplicate Post Risk
U-V3-03 may use request-scoped best-effort idempotency only.

Requirements:
- No persistent dedupe store is required in this unit.
- Retry behavior must be documented in code summary.
- If Code Generation adds retry support, it must avoid duplicate Slack posts through an explicit idempotency key or persisted delegation record.

## NFR-SD-T1: Testability
The implementation must be covered with focused automated tests.

Required tests:
- message builder includes `@Claude`, task title, deliverable, constraints, and bounded preview.
- no approval rejects before Slack token/client call.
- wrong-owner/missing task rejects before Slack post.
- Slack API failure maps to safe error.
- success posts expected text and returns safe timestamp result.
- MCP route/tool dispatch no longer returns reserved status for `saborou_delegate_to_claude`.
- existing backend tests and CDK drift tests remain green.

## NFR-SD-M1: Maintainability
Delegation behavior should be isolated from route plumbing.

Requirements:
- Put message building and delegation orchestration in a dedicated backend service/module or a clearly isolated helper.
- Keep Slack route handler thin.
- Keep U-V3-02 registry metadata aligned with the implemented route.
- Document residual risks in Code Generation summary.

## NFR-SD-U1: Voice-Agent Usability
Responses should be concise and safe for voice readout.

Requirements:
- Success response should state that the delegation message was posted, not that Claude completed the task.
- Include a bounded `delegatedTextPreview`.
- Error messages should be short and actionable.

## Security Baseline Compliance Summary
| Rule | Status | Rationale |
|---|---|---|
| SECURITY-01 Encryption | N/A | U-V3-03 introduces no new persistence store. Existing stores are unchanged. |
| SECURITY-02 Access Logging | N/A | No new network intermediary is introduced in this stage. |
| SECURITY-03 Application Logging | Applicable | Safe structured audit metadata is required. |
| SECURITY-04 HTTP Security Headers | N/A | No HTML-serving endpoint is introduced. |
| SECURITY-05 Input Validation | Applicable | All route/MCP input must be schema-validated. |
| SECURITY-06 Least Privilege | N/A | No new IAM policy is required unless later Infrastructure Design finds a change. |
| SECURITY-07 Network Configuration | N/A | No network configuration change is introduced. |
| SECURITY-08 Access Control | Applicable | Authenticated user context and task ownership are mandatory. |
| SECURITY-09 Hardening | Applicable | Safe errors must hide stack traces, tokens, and internals. |
| SECURITY-10 Supply Chain | Applicable | No untrusted dependency is required; existing lockfile verification remains required. |
| SECURITY-11 Secure Design | Applicable | Approval guard, validation, authorization, and safe logging provide defense in depth. |
| SECURITY-12 Credential Management | Applicable | Slack token retrieval must reuse existing secret path and never log credentials. |
| SECURITY-13 through SECURITY-15 | N/A | No new compliance, crypto, or data lifecycle behavior is introduced by this unit. |
