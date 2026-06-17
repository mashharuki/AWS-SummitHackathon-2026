# U-V3-03 Domain Entities: slack-claude-delegation

## Purpose
U-V3-03 adds the business capability to delegate a selected SABOROU task to Slack's `@Claude` participant after explicit user approval.

The public MCP tool name is `saborou_delegate_to_claude`, matching the U-V3-02 registry contract. Earlier planning text used `saborou_delegate_task_to_claude`; that name is treated as superseded design terminology, not as a second published tool.

## Domain Entities

### SlackClaudeDelegationRequest
Represents a user's approved intent to post a delegation message.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `userId` | string | Yes | Resolved by authenticated Hono/MCP context, never trusted from request body. |
| `taskId` | string | Yes | Selected SABOROU task. Must be owned by `userId`. |
| `channelId` | string | Yes | Slack channel or DM id. The request must provide it explicitly. |
| `threadTs` | string | No | Optional Slack thread timestamp. |
| `instruction` | string | No | Optional user-provided instruction override or additional constraints. |
| `approved` | boolean | Yes | Must be `true` before any Slack post is attempted. |
| `requestId` | string | Yes | Correlates logs and safe response output. |

### DelegableTaskContext
The task information allowed to appear in the Slack delegation message.

| Field | Type | Notes |
|---|---|---|
| `taskId` | string | Echoed for traceability. |
| `title` | string | Required primary task label. |
| `description` | string | Optional background. Must be bounded before posting. |
| `deadline` | string or null | Optional expected timing. |
| `requester` | string | Optional human/business origin. |
| `plannedSteps` | array | Optional summarized implementation hints, never dumped verbatim if too long. |

### ClaudeDelegationMessage
The generated Slack text to post.

Required content:
- `@Claude` mention at the start or first sentence.
- Task title.
- Background or description when present.
- Expected deliverable.
- Constraints and caveats.
- A short note that the request was delegated by SABOROU on behalf of the user.

### SlackDelegationApproval
Represents the side-effect authorization decision.

| Field | Type | Notes |
|---|---|---|
| `required` | boolean | Always true for `saborou_delegate_to_claude`. |
| `approved` | boolean | Must be true. |
| `approvalSource` | string | Voice, UI, or MCP approval metadata if available. |

### SlackDelegationResult
Safe success response after Slack accepts the post.

| Field | Type | Notes |
|---|---|---|
| `ok` | true | Indicates Slack post accepted. |
| `taskId` | string | Delegated task id. |
| `channelId` | string | Posting destination. |
| `ts` | string | Slack message timestamp. |
| `delegatedTextPreview` | string | Bounded preview for voice/UI confirmation. |

### SlackDelegationFailure
Safe failure response.

| Field | Type | Notes |
|---|---|---|
| `code` | string | `VALIDATION_ERROR`, `FORBIDDEN`, `TASK_NOT_FOUND`, `SLACK_API_ERROR`, or `TOOL_ERROR`. |
| `message` | string | Safe human-readable summary. |
| `requestId` | string | Correlation id. |

Forbidden output:
- Slack bot token.
- Raw AWS/Secrets Manager errors.
- Stack traces.
- Full unbounded task description or prompt text in logs.

### SlackDelegationAuditEvent
Structured audit event for observability.

| Field | Type | Notes |
|---|---|---|
| `action` | string | `slack_claude_delegation`. |
| `requestId` | string | Correlation id. |
| `toolName` | string | `saborou_delegate_to_claude`. |
| `userIdHash` | string | Hashed user id only. |
| `taskIdHash` | string | Hashed or omitted task id; raw task body is not logged. |
| `channelId` | string | Channel id may be logged only if current logging policy allows non-secret operational ids. |
| `status` | string | success/failure category. |
| `durationMs` | number | Latency measurement. |

## Relationships
- `SlackClaudeDelegationRequest` references one `DelegableTaskContext`.
- `DelegableTaskContext` is loaded through `DynamoTaskRepository.findById(userId, taskId)`, which enforces ownership by key shape.
- `ClaudeDelegationMessage` is derived from `DelegableTaskContext` and optional `instruction`.
- `SlackDelegationResult` is produced only after Slack `chat.postMessage` succeeds.
- `SlackDelegationAuditEvent` records only safe metadata for every attempt.
