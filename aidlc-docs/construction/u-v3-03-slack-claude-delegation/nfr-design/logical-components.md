# U-V3-03 Logical Components: slack-claude-delegation

## Component Summary
U-V3-03 is implemented as backend application logic that reuses existing repository, Slack token, and Slack client boundaries.

## LC-SD-01: Delegation Route Adapter

### Responsibility
Handle direct Hono API calls for Slack `@Claude` delegation.

### Expected Location
`pkgs/backend/src/routes/slack.ts`

### Responsibilities
- Apply existing auth middleware.
- Validate request body with Zod.
- Resolve `userId` from route context.
- Call `SlackDelegationService`.
- Map service results/errors to safe HTTP responses.

### Non-Responsibilities
- Message formatting internals.
- Slack token management internals.
- Task repository key construction.

## LC-SD-02: MCP Delegation Dispatch Adapter

### Responsibility
Connect `saborou_delegate_to_claude` MCP invocations to the same business service used by the direct route.

### Expected Location
Existing MCP route/dispatch module, or a dedicated dispatch helper if Code Generation introduces one.

### Responsibilities
- Use U-V3-02 parsed args.
- Preserve approval-required behavior.
- Replace reserved response for `saborou_delegate_to_claude` with implemented behavior.
- Return safe MCP success/error envelopes.

### Non-Responsibilities
- Bypassing the approval guard.
- Creating a second tool name.

## LC-SD-03: SlackDelegationService

### Responsibility
Orchestrate approval, task lookup, message generation, Slack post, and safe result.

### Expected Location
`pkgs/backend/src/services/SlackDelegationService.ts`

### Inputs
- trusted `userId`
- `taskId`
- `channelId`
- optional `threadTs`
- optional `instruction`
- `approved`
- `requestId`

### Outputs
- safe success result with `taskId`, `channelId`, Slack `ts`, and bounded preview
- typed safe failure or thrown application error mapped by adapters

### Dependencies
- `DynamoTaskRepository`
- `getSlackToken`
- `SlackClient`
- `DelegationMessageBuilder`
- safe audit helper

## LC-SD-04: DelegationApprovalGuard

### Responsibility
Fail fast before any side-effect-capable dependency is touched.

### Behavior
- If `approved !== true`, return/throw safe forbidden error.
- The guard runs before task lookup and Slack token lookup.

### Test Requirement
Mocks must prove no Slack token/client call occurs when this guard rejects.

## LC-SD-05: DelegationMessageBuilder

### Responsibility
Build deterministic Slack text and bounded preview.

### Inputs
- task title
- description/background
- requester
- deadline
- planned steps summary
- instruction

### Outputs
- `text`: full bounded Slack post body
- `preview`: shorter bounded preview for response/voice

### Rules
- Include `@Claude`.
- Include task title.
- Include expected deliverable.
- Include constraints.
- Include SABOROU approval attribution.
- Do not call Bedrock or other LLMs.

## LC-SD-06: SlackPostClient Boundary

### Responsibility
Call Slack through the existing `SlackClient`.

### Behavior
- Fetch per-user token through `getSlackToken(userId)`.
- Post once through `chat.postMessage`.
- Do not retry without idempotency support.
- Convert Slack failures through Safe Slack Error Mapper.

## LC-SD-07: Safe Slack Error Mapper

### Responsibility
Normalize Slack and unexpected failures.

### Output Categories
- `VALIDATION_ERROR`
- `FORBIDDEN`
- `TASK_NOT_FOUND`
- `SLACK_API_ERROR`
- `TOOL_ERROR`

### Redaction Rules
- No token.
- No stack trace.
- No raw secret error.
- No raw Slack response body if sensitive.

## LC-SD-08: Delegation Audit Logger

### Responsibility
Emit safe structured metadata for each delegation attempt.

### Event Fields
- `action`
- `requestId`
- `toolName`
- `userIdHash`
- `status`
- `durationMs`

### Excluded Fields
- token
- full delegated text
- instruction
- task description
- raw Slack response

## LC-SD-09: Registry And Schema Contract

### Responsibility
Keep U-V3-02 publication metadata aligned.

### Expected Code Generation Changes
- `saborou_delegate_to_claude` remains in the registry.
- `approval.required` remains true.
- `implementationStatus` changes from reserved to implemented only when dispatch is implemented.
- OpenAPI drift tests continue to pass.

## Component Interaction Sequence
1. Route or MCP adapter receives validated request.
2. Approval guard checks `approved`.
3. Service loads task with trusted `userId`.
4. Message builder creates text and preview.
5. Slack token/client boundary posts to Slack.
6. Error mapper normalizes failures if any.
7. Audit logger emits safe metadata.
8. Adapter returns safe HTTP/MCP response.

## Infrastructure Impact Assessment
Current NFR Design identifies no required infrastructure change.

Infrastructure Design can be skipped if Code Generation confirms:
- no new IAM permission,
- no new env var,
- no new Secrets Manager secret,
- no new API Gateway/CDK construct,
- no new persistence store.

If any of those changes become necessary during Code Generation planning, Infrastructure Design must execute before code generation.
