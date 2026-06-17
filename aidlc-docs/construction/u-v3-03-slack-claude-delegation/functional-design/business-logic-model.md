# U-V3-03 Business Logic Model: slack-claude-delegation

## Main Capability
Post a Slack `@Claude` delegation message for a caller-owned task after explicit user approval.

## Public Contracts

### MCP Tool
- Tool name: `saborou_delegate_to_claude`
- Effect: side effect
- Approval: required
- Current U-V3-02 status: reserved
- U-V3-03 responsibility: implement the reserved contract.

### Backend Route Candidate
- Method: `POST`
- Path: `/api/slack/delegations`
- Auth: existing Cognito/JWT route auth for direct API; MCP adapter identity for AgentCore path.

Request shape:

```json
{
  "taskId": "task-123",
  "channelId": "C12345678",
  "threadTs": "1718600000.123456",
  "instruction": "Please prepare a concise first draft.",
  "approved": true
}
```

Response shape:

```json
{
  "ok": true,
  "taskId": "task-123",
  "channelId": "C12345678",
  "ts": "1718600000.234567",
  "delegatedTextPreview": "@Claude Please help with..."
}
```

## Service Responsibilities

### SlackDelegationService
Business service responsible for:
1. Checking explicit approval.
2. Loading the selected task through a user-scoped repository call.
3. Building the delegation message.
4. Posting to Slack with the user's bot token.
5. Returning a safe result.

### DelegationMessageBuilder
Pure business formatter responsible for creating bounded Slack text.

Inputs:
- task title
- task description
- deadline
- requester
- planned steps summary
- optional user instruction

Output:
- Slack-ready text containing `@Claude` and the required business context.

### DelegationApprovalGuard
Small guard responsible for rejecting missing approval before token lookup or Slack posting.

## Success Flow
1. Receive authenticated request or MCP invocation.
2. Validate request shape.
3. Confirm `approved === true`.
4. Resolve `userId` from trusted context.
5. Load task with `taskRepository.findById(userId, taskId)`.
6. If the task is missing, return a safe not-found response.
7. Build the delegation message.
8. Fetch per-user Slack bot token with existing token handling.
9. Post message to Slack channel/thread.
10. Return safe success result with Slack timestamp and bounded text preview.
11. Emit safe audit metadata.

## Failure Flows

### Missing Approval
1. Request arrives with `approved` missing or false.
2. Approval guard rejects.
3. No task lookup, token lookup, or Slack call is performed.
4. Safe `FORBIDDEN` response is returned.

### Invalid Input
1. Request validation fails.
2. Safe `VALIDATION_ERROR` response is returned.
3. No Slack side effect is performed.

### Task Missing Or Wrong Owner
1. Request is valid and approved.
2. Repository lookup by `userId` and `taskId` returns null.
3. Safe not-found response is returned.
4. No Slack side effect is performed.

### Slack API Failure
1. Request is valid, approved, and task-owned.
2. Slack post fails.
3. Safe `SLACK_API_ERROR` response is returned.
4. Token and raw internals are not logged or returned.

## Message Template Rules
The message builder should produce a compact structure:

```text
@Claude Please help with this SABOROU task.

Task: <title>
Background: <description or requester context>
Expected deliverable: <instruction-derived deliverable or default deliverable>
Constraints: <deadline, planned steps, and user instruction constraints>

Delegated by SABOROU after user approval.
```

The exact wording can be tuned in Code Generation, but the required sections must remain.

## Boundary With U-V3-02
U-V3-02 validates the tool contract and currently returns a reserved response for `saborou_delegate_to_claude`.

U-V3-03 Code Generation must:
- keep the same tool name,
- replace the reserved response with implemented dispatch,
- keep approval-required metadata,
- update tests so the registry and OpenAPI drift gate continue passing.

## Test Scenarios For Code Generation
- Success: approved request posts `@Claude` message for a user-owned task.
- No approval: request is rejected before Slack token lookup.
- Wrong owner: task lookup returns null and no Slack post occurs.
- Slack failure: safe `SLACK_API_ERROR` response without token/internal details.
- Message generation: output includes task title, expected deliverable, constraints, and `@Claude`.
- Registry integration: `saborou_delegate_to_claude` no longer returns reserved status after implementation.
