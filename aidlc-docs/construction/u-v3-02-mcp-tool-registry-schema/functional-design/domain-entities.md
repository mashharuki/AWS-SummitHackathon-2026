# Domain Entities - U-V3-02 mcp-tool-registry-schema

**作成日**: 2026-06-17 JST
**Unit**: U-V3-02 mcp-tool-registry-schema

---

## Entity Summary

U-V3-02 defines the business domain for SABOROU MCP tool publication. The central concept is an allowlisted `McpToolDefinition` that is shared by runtime dispatch, OpenAPI generation or validation, and tests.

---

## McpToolName

Stable voice-facing tool identifier. Tool names must be explicit, action-oriented, and prefixed with `saborou_`.

Approved names:

| Tool Name | Business Purpose |
|-----------|------------------|
| `saborou_get_tasks` | Retrieve authenticated user's approved task list. |
| `saborou_get_task` | Retrieve one authenticated user-owned task. |
| `saborou_judge_sabori` | Generate a Slack reply draft and voice summary from an incoming message. |
| `saborou_send_slack_reply` | Post a user-approved reply to Slack. |
| `saborou_schedule_report` | Generate a progress report draft for one task. |
| `saborou_get_google_calendar_status` | Read cached Google Calendar availability context. |
| `saborou_fetch_google_calendar` | Fetch Calendar data and extract task candidates after approval. |
| `saborou_fetch_gmail_tasks` | Fetch Gmail snippets and extract task candidates after approval. |
| `saborou_get_slack_channels` | List Slack channels available to the user's bot token. |
| `saborou_sync_slack_messages` | Fetch Slack message history and enqueue task extraction after approval. |
| `saborou_create_task` | Create a manual task from voice input. |
| `saborou_approve_task_candidate` | Promote a candidate to an approved task after approval. |
| `saborou_delegate_task_to_claude` | Reserved contract for Slack `@Claude` delegation; implemented in U-V3-03. |

---

## McpToolDefinition

Single registry item used by runtime, schema, and tests.

Required fields:

| Field | Type | Meaning |
|-------|------|---------|
| `name` | `McpToolName` | Stable MCP tool name. |
| `operationId` | string | OpenAPI operationId. Must equal `name` or map one-to-one through a documented alias table. |
| `method` | HTTP method | Backend method reached through adapter. |
| `path` | string | Backend path reached through adapter. |
| `description` | string | English AI-oriented usage description. |
| `effect` | `read` / `write` / `external-post` | Side-effect classification. |
| `requiresHumanApproval` | boolean | Whether voice/user approval is mandatory. |
| `inputSchema` | schema reference | Zod/OpenAPI-compatible input contract. |
| `outputSchema` | schema reference | Voice-agent-friendly output contract. |
| `enabledInMcp` | boolean | Publication flag. |

---

## ToolEffect

Side-effect classification for approval and safety.

| Effect | Definition | Approval |
|--------|------------|----------|
| `read` | Reads user-owned SABOROU data or cached context. | Not required. |
| `write` | Mutates SABOROU state or imports external data into SABOROU. | Required. |
| `external-post` | Posts to external systems such as Slack. | Required. |

---

## McpSchemaSource

Source of truth for MCP publication.

Preferred entity:

- Registry-owned definitions generate or validate `pkgs/cdk/schemas/saborou-openapi.yaml`.

Fallback entity:

- Drift detector compares registry definitions against hand-written YAML and fails tests on mismatch.

The business invariant is that the published AgentCore schema cannot diverge silently from the allowlist.

---

## ExcludedRoute

Routes that must never be published as voice-callable MCP tools.

| Route Category | Examples | Reason |
|----------------|----------|--------|
| Health/system | `/health` | Not user workflow value. |
| OAuth start/callback | `/api/auth/slack`, `/api/auth/google/callback` | Browser redirect and token exchange only. |
| Webhooks | `/webhooks/slack` | External provider ingress, not user-invoked. |
| Destructive cleanup | task delete, connection delete | Too risky for voice MVP. |
| Internal planning helpers | candidate plan-steps, planned-steps patch | UI-specific workflow detail. |

---

## SchemaDriftReport

Validation result showing mismatch between tool registry and OpenAPI/route surfaces.

Fields:

| Field | Meaning |
|-------|---------|
| `missingFromSchema` | Allowed registry tools not present in AgentCore OpenAPI. |
| `unexpectedInSchema` | OpenAPI operations not in allowlist. |
| `operationIdMismatch` | Path/method exists but operationId does not match registry. |
| `unsafePublishedRoutes` | OAuth/webhook/health/internal routes accidentally published. |
| `descriptionFailures` | Missing or non-AI-oriented descriptions. |
| `schemaFailures` | Missing request/response schema constraints. |

Any non-empty field is a Code Generation blocking failure.
