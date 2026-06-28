# Business Logic Model - U-V3-02 mcp-tool-registry-schema

**作成日**: 2026-06-17 JST
**Unit**: U-V3-02 mcp-tool-registry-schema

---

## Model Summary

U-V3-02 introduces a single MCP tool registry model that drives three business behaviors:

1. Runtime allowlist and side-effect precheck.
2. AgentCore OpenAPI tool publication.
3. Drift detection between registry, schema, and backend route surface.

---

## Tool Registry Construction

Input:

- Approved U-V3-02 tool list.
- Existing backend route contracts.
- Existing Zod/shared schemas where available.
- Side-effect approval rules.

Output:

- Ordered `McpToolDefinition[]`.
- Exclusion list for unsafe/non-voice routes.
- Schema validation report.

Algorithm:

1. Start from the approved MCP tool list.
2. Assign each tool a backend method/path.
3. Classify each tool as `read`, `write`, or `external-post`.
4. Set `requiresHumanApproval` from effect.
5. Attach input schema and output schema.
6. Attach AI-oriented English description.
7. Reject any tool missing required metadata.

---

## Proposed Tool Contract Matrix

| Tool | Backend Route | Effect | Approval | U-V3-02 Action |
|------|---------------|--------|----------|----------------|
| `saborou_get_tasks` | `GET /api/tasks` | read | No | Publish now. |
| `saborou_get_task` | `GET /api/tasks/{id}` | read | No | Publish now. |
| `saborou_judge_sabori` | `POST /api/proposals/judge` | read | No | Publish with clarified semantics. |
| `saborou_send_slack_reply` | `POST /api/slack/reply` | external-post | Yes | Publish with approval metadata. |
| `saborou_schedule_report` | `POST /api/tasks/{id}/report` | read | No | Publish as draft generation only. |
| `saborou_get_google_calendar_status` | `GET /api/google/calendar/status` | read | No | Publish now. |
| `saborou_fetch_google_calendar` | `POST /api/google/calendar/fetch` | write | Yes | Publish with approval metadata. |
| `saborou_fetch_gmail_tasks` | `POST /api/google/gmail/fetch` | write | Yes | Publish with approval metadata. |
| `saborou_get_slack_channels` | `GET /api/slack/channels` | read | No | Publish now. |
| `saborou_sync_slack_messages` | `POST /api/slack/sync-messages` | write | Yes | Publish with approval metadata. |
| `saborou_create_task` | `POST /api/tasks` | write | Yes | Publish with approval metadata. |
| `saborou_approve_task_candidate` | `POST /api/tasks/candidates/{id}/approve` | write | Yes | Publish with approval metadata. |
| `saborou_delegate_task_to_claude` | U-V3-03 route | external-post | Yes | Define reserved schema; implementation later. |

---

## Runtime Invocation Model

The U-V3-01 adapter remains the entry point.

Execution order:

1. Resolve `McpToolContext` through Cognito-backed identity.
2. Lookup `toolName` in `McpToolRegistry`.
3. Validate args against the tool input schema.
4. Check approval if `requiresHumanApproval` is true.
5. Dispatch to the mapped backend service or route handler.
6. Validate or normalize output into the tool output schema.
7. Emit safe audit event.

Failure behavior:

| Failure | Result |
|---------|--------|
| Unknown tool | `TOOL_NOT_ALLOWED` |
| Missing required input | `VALIDATION_ERROR` |
| Missing approval for side-effect | `FORBIDDEN` |
| User does not own resource | existing 404 or `FORBIDDEN` |
| Provider failure | safe provider-specific error summary |

---

## Schema Publication Model

Preferred Code Generation path:

1. Store registry definitions in application/shared code.
2. Generate or validate AgentCore OpenAPI from registry.
3. Keep `pkgs/cdk/schemas/saborou-openapi.yaml` as generated output or a checked artifact validated against registry.
4. CDK deploys the schema to AgentCore as before.

Minimum acceptable path:

1. Maintain hand-written `saborou-openapi.yaml`.
2. Add tests that parse YAML and compare operationIds/path/methods against registry.
3. Fail tests when drift occurs.

---

## Drift Detection Model

Inputs:

- `McpToolRegistry`.
- `pkgs/cdk/schemas/saborou-openapi.yaml`.
- Explicit excluded route list.

Checks:

1. Every `enabledInMcp` registry tool appears exactly once in YAML.
2. No YAML operation appears outside registry.
3. No excluded route appears in YAML.
4. Every operation has operationId, summary, description, request schema if needed, and response schema.
5. Every side-effect tool is marked approval-required in registry.
6. Legacy operationIds such as `listTasks`, `judgeSabori`, and `streamProposal` are replaced or mapped.

---

## Exclusion Model

Do not publish:

- `/health`
- `/api/auth/*`
- `/webhooks/*`
- `/api/connections/*`
- task delete/update endpoints
- honne endpoints
- planned-steps endpoints
- OAuth disconnect endpoints

Rationale:

- They are not voice-first actions, are provider callback flows, or are too risky for voice MVP.

---

## Output Normalization Model

Every tool output must be suitable for voice agent use.

Required output qualities:

- Stable top-level object.
- Short summary field where useful.
- IDs for follow-up calls.
- No raw provider response.
- No secrets or tokens.
- No unbounded message bodies.

Examples:

- Task list returns task IDs, titles, deadlines, requester, and compact status.
- Calendar fetch returns counts and extracted candidate summaries.
- Gmail fetch returns counts and candidate summaries.
- Slack reply returns `ok`, timestamp, and taskId if present.

---

## Functional Completion Criteria

- Tool allowlist is explicit.
- Side-effect classification is explicit.
- Exclusion rules are explicit.
- Schema drift failure conditions are explicit.
- `saborou_judge_sabori` semantics are clarified.
- `saborou_delegate_task_to_claude` contract is reserved for U-V3-03.
