# Business Rules - U-V3-02 mcp-tool-registry-schema

**作成日**: 2026-06-17 JST
**Unit**: U-V3-02 mcp-tool-registry-schema

---

## BR-U3-02-01: Allowlist-Only Publication

Only tools listed in `McpToolDefinition[]` may be published through AgentCore/OpenAPI or accepted by runtime dispatch.

Rejected behavior:

- Publishing every Hono route automatically.
- Publishing OAuth callbacks, webhooks, health checks, or UI-only helper routes.
- Letting OpenAPI operations exist without matching registry entries.

---

## BR-U3-02-02: Stable Tool Naming

Every public MCP tool must use a stable `saborou_*` name.

Rules:

- Name must be lower snake case.
- Name must describe the business action.
- Name must not expose implementation names like `streamProposal`.
- If a legacy operationId exists, it must be replaced or mapped explicitly.

---

## BR-U3-02-03: AI-Oriented English Description

Every tool must have an English description written for LLM tool selection.

Description must include:

- When to use the tool.
- What user intent it satisfies.
- Whether it reads data or performs side effects.
- Whether approval is required before calling.

---

## BR-U3-02-04: Schema-First Validation

Every tool must have input and output schemas.

Input schemas must specify:

- Required fields.
- String length limits.
- Enums where applicable.
- ID field formats where practical.
- Object shape for optional approval metadata.

Output schemas must be stable and voice-friendly:

- Include summary fields suitable for voice readout.
- Avoid raw provider payloads.
- Avoid tokens, full Gmail bodies, Slack raw event bodies, or stack traces.

---

## BR-U3-02-05: Side-Effect Approval

Tools with `effect = write` or `effect = external-post` must require explicit approval metadata.

Approval-required tools:

- `saborou_send_slack_reply`
- `saborou_fetch_google_calendar`
- `saborou_fetch_gmail_tasks`
- `saborou_sync_slack_messages`
- `saborou_create_task`
- `saborou_approve_task_candidate`
- `saborou_delegate_task_to_claude`

Read-only tools:

- `saborou_get_tasks`
- `saborou_get_task`
- `saborou_judge_sabori`
- `saborou_schedule_report`
- `saborou_get_google_calendar_status`
- `saborou_get_slack_channels`

Note: `saborou_schedule_report` generates a draft only and does not post externally, so it is read-like from a side-effect perspective in U-V3-02.

---

## BR-U3-02-06: User Scope Preservation

Every tool runs under the `McpToolContext.userId` created in U-V3-01.

Rules:

- Tool args must not be trusted as user identity.
- Resource IDs must be resolved through user-scoped repository calls.
- Cross-user resources return existing safe 404 or forbidden semantics.

---

## BR-U3-02-07: Schema Drift Is Blocking

Code Generation must add a validation mechanism that fails if registry and published schema diverge.

Blocking drift examples:

- Allowlisted tool missing from `saborou-openapi.yaml`.
- Non-allowlisted route published in `saborou-openapi.yaml`.
- Operation has no `operationId`.
- Operation description is empty or generic.
- Tool marked side-effect but `requiresHumanApproval` is false in registry.

---

## BR-U3-02-08: Sabori Judge Semantics

`saborou_judge_sabori` must be described as reply draft generation plus voice summary unless a real score algorithm is implemented.

Rules:

- Do not claim a fixed `saboriScore` is a meaningful confidence score.
- If score remains present for compatibility, mark it as provisional or derive it from verdict/reasoning.
- Voice output should prioritize `ttsSummary` and `replyDraft`.

---

## BR-U3-02-09: Reserved Delegation Contract

`saborou_delegate_task_to_claude` may be included in registry and schema as a reserved or planned tool contract, but runtime behavior belongs to U-V3-03.

Rules:

- U-V3-02 may define input/output schema and approval classification.
- U-V3-02 must not implement Slack `@Claude` posting behavior.
- Tests may assert the contract exists as pending implementation if Code Generation chooses that route.

---

## BR-U3-02-10: Provider Data Minimization

Google and Slack tools must expose summarized outputs, not raw provider payloads.

Rules:

- Gmail body is not returned.
- Calendar event titles/descriptions are not returned unless already converted to task candidates.
- Slack history import returns counts and candidate references, not raw message bodies.
- Channel list may return IDs and display names only.
