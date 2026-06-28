# U-V3-03 Business Rules: slack-claude-delegation

## BR-U-V3-03-01: Tool Name Alignment
The implemented MCP tool and backend contract must use `saborou_delegate_to_claude`, matching the U-V3-02 registry and OpenAPI schema.

`saborou_delegate_task_to_claude` remains a historical planning phrase only and must not be published as a second MCP tool.

## BR-U-V3-03-02: Explicit Approval Required
Delegation is a Slack side effect. The system must reject the request unless approval metadata is explicitly true.

Expected failure:
- HTTP/MCP safe error code: `FORBIDDEN`
- No Slack token retrieval.
- No Slack API call.

## BR-U-V3-03-03: Authenticated User Is Source of Truth
`userId` must come from authenticated route context or the verified MCP identity context.

Request body `userId` must be ignored or rejected.

## BR-U-V3-03-04: Task Ownership Required
The selected task must be loaded with `findById(userId, taskId)`.

If no task is found, the response must not reveal whether the task exists for another user.

Expected failure:
- Safe `TASK_NOT_FOUND` or existing `NotFoundError` mapping.
- No Slack post.

## BR-U-V3-03-05: Destination Must Be Explicit
`channelId` is required for U-V3-03.

No implicit global default channel is introduced in this unit. If a later product decision adds defaults, it must be designed as an explicit configuration and approval concern.

## BR-U-V3-03-06: Message Content Requirements
The generated Slack message must contain:
- `@Claude`
- task title
- background or task description when available
- expected deliverable
- constraints, including deadline when available
- short source attribution that SABOROU delegated the task after user approval

The message must be bounded before posting to Slack.

## BR-U-V3-03-07: Instruction Override Is Additive
User-provided `instruction` may add context or constraints, but it must not remove the task title, expected deliverable, or approval requirement.

## BR-U-V3-03-08: No Claude Execution Guarantee
SABOROU's responsibility ends when Slack accepts the `@Claude` delegation post.

The system must not claim that Claude completed the task. The safe success response should report that the delegation message was posted.

## BR-U-V3-03-09: Safe Slack Error Handling
Slack API failures must return safe summaries.

The response and logs must not include:
- bot token
- raw authorization headers
- stack traces
- raw Slack response bodies if they contain sensitive details

## BR-U-V3-03-10: Idempotency Is Best-Effort In This Unit
The first implementation may be request-scoped and test-covered for single invocation.

If retries are added, they must avoid duplicate Slack posts through an explicit idempotency key or persisted delegation record. U-V3-03 Code Generation must document whether persistence is added or deferred.

## BR-U-V3-03-11: Audit Without Sensitive Payload
Every attempt must be auditable with safe metadata:
- request id
- tool name or route action
- hashed user id
- status
- duration

Task description, user instruction, Slack token, and full delegated text must not be logged.

## BR-U-V3-03-12: Existing Slack Reply Behavior Must Remain Compatible
U-V3-03 may add a new `/api/slack/delegations` route or equivalent service boundary, but it must not weaken or change the existing `/api/slack/reply` approval and error behavior.

## Security Baseline Mapping
| Rule | Applicability | U-V3-03 Compliance Direction |
|---|---|---|
| SECURITY-03 Application-Level Logging | Applicable | Structured safe audit metadata only. |
| SECURITY-05 Input Validation | Applicable | Validate `taskId`, `channelId`, `threadTs`, `instruction`, and approval shape. |
| SECURITY-08 Application-Level Access Control | Applicable | Auth middleware/MCP identity plus object-level task ownership. |
| SECURITY-09 Error Hardening | Applicable | Safe Slack and internal error summaries. |
| SECURITY-12 Credential Management | Applicable | Reuse existing per-user Slack token retrieval; never log token. |
| Other Security Baseline rules | N/A for Functional Design | No new storage, network, IAM, or web headers are designed in this stage. |
