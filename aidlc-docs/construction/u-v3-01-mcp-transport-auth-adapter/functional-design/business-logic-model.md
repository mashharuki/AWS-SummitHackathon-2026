# Business Logic Model - U-V3-01 mcp-transport-auth-adapter

**作成日**: 2026-06-16
**Unit**: U-V3-01 mcp-transport-auth-adapter

---

## Model Overview

U-V3-01 introduces a user-aware MCP adapter boundary. The key behavior is not a new SABOROU feature; it is a safety gate that converts an externally authenticated MCP tool invocation into an internal, user-scoped SABOROU operation.

The model has four steps:

1. Normalize invocation metadata.
2. Resolve and verify user identity.
3. Authorize tool execution before resource access.
4. Dispatch or reject with safe audit logging.

---

## Main Flow: MCP Tool Invocation

| Step | Actor | Logic | Output |
|------|-------|-------|--------|
| 1 | ElevenLabs / AgentCore | Sends a remote MCP tool call to SABOROU. | Raw request and tool name. |
| 2 | Adapter Entry | Creates or propagates `requestId`, records `receivedAt`, and identifies source as `agentcore`. | `McpInvocation`. |
| 3 | Identity Resolver | Reads verified Gateway/Cognito context and resolves `userId`. | `McpCallerIdentity`. |
| 4 | Tool Registry | Checks that `toolName` is MCP-published and permitted. | Allowed tool definition. |
| 5 | Adapter | Builds `McpToolContext` with userId, requestId, source, and approval metadata. | `McpToolContext`. |
| 6 | Adapter | Validates arguments and dispatches to the appropriate domain service or existing reusable handler logic. | Normalized result. |
| 7 | Audit Logger | Logs safe tool-call status and duration. | `McpAuditEvent`. |

---

## Alternate Flow: Missing Or Invalid Identity

| Step | Logic |
|------|-------|
| 1 | Adapter receives invocation. |
| 2 | Identity resolver cannot find a verified Cognito-backed subject or audience is invalid. |
| 3 | Adapter stops before tool registry dispatch. |
| 4 | Audit event is written with `status = "unauthorized"`. |
| 5 | Voice-safe `UNAUTHORIZED` error is returned. |

---

## Alternate Flow: Disallowed Tool

| Step | Logic |
|------|-------|
| 1 | Adapter receives invocation with a tool name. |
| 2 | Identity is valid. |
| 3 | Tool registry rejects the tool name. |
| 4 | No domain service executes. |
| 5 | Audit event is written with `status = "forbidden"` or `status = "validation_error"` depending on final implementation convention. |
| 6 | Voice-safe `TOOL_NOT_ALLOWED` error is returned. |

---

## Alternate Flow: Cross-User Resource Access

| Step | Logic |
|------|-------|
| 1 | Adapter resolves `userId = A`. |
| 2 | Tool args reference a resource ID owned by user B. |
| 3 | Repository/service query is scoped by `userId = A`. |
| 4 | Resource is not returned. |
| 5 | Adapter returns existing 404 behavior or a safe authorization error without exposing user B's data. |

---

## Adapter Dispatch Boundary

U-V3-01 defines the boundary but does not expand the full tool catalog. Dispatch behavior is limited to:

- Accept a normalized `toolName`.
- Require a resolved `McpToolContext`.
- Validate that domain calls receive `userId` from context.
- Preserve existing route behavior for direct Hono API fallback.

Full tool schemas and broad allowlist expansion are handled by U-V3-02.

---

## Data Transformation

| Input | Transformation | Output |
|-------|----------------|--------|
| Raw Gateway request | Extract request metadata and verified claims. | `McpInvocation` and `McpCallerIdentity`. |
| Verified claims | Resolve Cognito subject to SABOROU `userId`. | `McpToolContext.userId`. |
| Tool result | Remove internal details and normalize for voice response. | Stable JSON object. |
| Failure | Map to safe error code and summary. | `McpAdapterError`. |

---

## Non-Goals For This Functional Design

- Defining every MCP tool schema.
- Implementing `@Claude` delegation text generation.
- Designing the SSE bridge internals.
- Choosing exact CDK route shape; that is finalized in Infrastructure Design.
