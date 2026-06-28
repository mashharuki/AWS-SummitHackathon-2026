# U-V3-03 NFR Design Patterns: slack-claude-delegation

## Pattern 1: Approval-First Guard

### Intent
Prevent any Slack side effect unless explicit approval is present.

### Applies To
- `saborou_delegate_to_claude` MCP dispatch
- Direct backend delegation route, expected as `POST /api/slack/delegations`

### Design
Run approval validation before:
- task repository lookup,
- Slack token lookup,
- Slack client construction,
- Slack API call.

### Verification
- Test missing/false approval returns `FORBIDDEN`.
- Test Slack token/client mock is not called when approval is missing.

### Security Mapping
- SECURITY-08
- SECURITY-11

## Pattern 2: Context-Derived User Identity

### Intent
Ensure callers cannot spoof the delegated task owner.

### Design
The service accepts `userId` only from trusted route/MCP context. Request body `userId` is not part of the public schema.

Task access uses:

```text
findById(userId, taskId)
```

### Verification
- Test request body cannot set/override `userId`.
- Test missing task/wrong owner returns safe not-found behavior.
- Test no Slack post occurs for missing task.

### Security Mapping
- SECURITY-08

## Pattern 3: Schema-First Delegation Input

### Intent
Reject malformed or unsafe request input before business execution.

### Design
Use Zod schemas for:
- `taskId`
- `channelId`
- `threadTs`
- `instruction`
- `approved`

The same constraints should be reflected in MCP schema metadata where applicable.

### Verification
- Unit tests reject empty task/channel ids.
- Unit tests reject oversized instruction.
- MCP schema tests continue passing.

### Security Mapping
- SECURITY-05

## Pattern 4: Deterministic Bounded Message Builder

### Intent
Generate predictable, testable, voice-demo-safe Slack text without an LLM dependency.

### Design
Create a pure message builder that:
- starts with or prominently includes `@Claude`,
- includes task title,
- includes bounded background,
- includes expected deliverable,
- includes constraints such as deadline, planned steps summary, and user instruction,
- appends source attribution that SABOROU delegated after user approval.

The builder must truncate bounded sections rather than logging or posting unbounded raw fields.

### Verification
- Unit tests assert required sections.
- Unit tests assert bounded preview/text behavior.

### NFR Mapping
- NFR-SD-P1
- NFR-SD-U1
- NFR-SD-M1

## Pattern 5: Secret-Safe Slack Post Boundary

### Intent
Reuse existing Slack token handling without leaking credentials.

### Design
The delegation service calls existing:
- `getSlackToken(userId)`
- `new SlackClient(botToken)`
- `postMessage({ channel, text, thread_ts })`

The bot token remains local to the service call and is never returned or logged.

### Verification
- Slack failure tests assert response does not contain token, secret name, or stack trace.
- Console/audit output tests assert no full message or token.

### Security Mapping
- SECURITY-03
- SECURITY-09
- SECURITY-12

## Pattern 6: Safe Slack Error Mapper

### Intent
Return actionable but non-sensitive errors for Slack failures.

### Design
Map known Slack errors to a safe response:
- code: `SLACK_API_ERROR`
- message: short user-facing summary

Unexpected failures map to a generic tool/server error without internal details.

### Verification
- Tests cover `SlackApiError`.
- Tests cover unexpected error fallback.

### Security Mapping
- SECURITY-09

## Pattern 7: Safe Delegation Audit Envelope

### Intent
Make side-effect attempts observable without storing sensitive payloads.

### Design
Audit metadata includes:
- action: `slack_claude_delegation`
- request id
- tool name
- hashed user id
- safe task id hash or omitted task id
- status
- duration

Audit metadata excludes:
- Slack token
- full delegated message
- instruction text
- task description
- raw Slack response body

### Verification
- Unit tests assert safe event shape.
- Targeted security check searches for token/message leakage in audit outputs.

### Security Mapping
- SECURITY-03

## Pattern 8: Registry Reserved-To-Implemented Transition

### Intent
Implement U-V3-02's reserved MCP tool without introducing schema drift.

### Design
Code Generation should update `saborou_delegate_to_claude` from reserved behavior to implemented dispatch.

Constraints:
- keep the same tool name,
- keep approval required,
- keep side-effect classification,
- keep OpenAPI operation id aligned.

### Verification
- Backend route/MCP tests assert no reserved response after implementation.
- CDK OpenAPI drift test remains green.

### NFR Mapping
- NFR-SD-R1
- NFR-SD-T1

## Pattern 9: No-New-Infrastructure Default

### Intent
Avoid unnecessary operational risk in U-V3-03.

### Design
Use existing backend Lambda, DynamoDB task repository, Secrets Manager Slack token path, and Slack client.

No new storage, queue, cache, IAM policy, or network component is required unless later Code Generation reveals a concrete gap.

### Verification
- Infrastructure Design can be skipped if no CDK/env/IAM changes are identified.
- Code Generation summary documents no infrastructure changes or lists any discovered exception.

## Pattern 10: Best-Effort Idempotency Disclosure

### Intent
Prevent hidden duplicate-post assumptions.

### Design
U-V3-03 does not add persistent dedupe state.

If a client retries after a timeout, duplicate Slack posts are possible unless the client provides and the backend enforces an idempotency key in a later unit/change.

### Verification
- Code Generation summary documents retry/duplicate behavior.
- No retry loop is added around `chat.postMessage` without dedupe.
