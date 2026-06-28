# Business Rules - U-V3-01 mcp-transport-auth-adapter

**作成日**: 2026-06-16
**Unit**: U-V3-01 mcp-transport-auth-adapter

---

## Identity And Authorization Rules

| Rule ID | Rule | Enforcement Point |
|---------|------|-------------------|
| BR-U3-01-01 | Existing browser/extension API calls must continue to use Cognito JWT through API Gateway JWT Authorizer. | Existing `authMiddleware` and API Gateway main route. |
| BR-U3-01-02 | MCP calls must resolve a Cognito-backed `userId` before any user-scoped resource access. | `McpIdentityResolver`. |
| BR-U3-01-03 | IAM role identity from `GATEWAY_IAM_ROLE` can prove service-to-service invocation, but never proves user identity. | `McpIdentityResolver` and `McpToolAdapter`. |
| BR-U3-01-04 | Missing, invalid, expired, or audience-mismatched JWT identity must fail with 401. | Identity resolution. |
| BR-U3-01-05 | Valid identity attempting to access another user's resource must fail without returning resource contents. | Repository/service boundary. |
| BR-U3-01-06 | OAuth callback, webhook, health, and internal/admin routes are not exposed through the MCP adapter. | Tool registry and adapter allowlist. |

---

## Adapter Invocation Rules

| Rule ID | Rule | Enforcement Point |
|---------|------|-------------------|
| BR-U3-01-07 | Every MCP invocation must have a requestId. | Adapter entry. |
| BR-U3-01-08 | Tool name must be checked against the allowlist before argument parsing or dispatch. | `McpToolRegistry.assertAllowed`. |
| BR-U3-01-09 | Tool arguments must be validated before domain service execution. | Tool-specific schema validation. |
| BR-U3-01-10 | Read tools may execute after authentication and input validation. | Tool adapter. |
| BR-U3-01-11 | Write or external-post tools require explicit `humanApproved === true`. | Tool adapter and later side-effect units. |
| BR-U3-01-12 | Adapter results must be normalized JSON suitable for a voice agent response. | Tool adapter output mapper. |

---

## Error Handling Rules

| Rule ID | Rule | Error |
|---------|------|-------|
| BR-U3-01-13 | Unknown tool name fails before dispatch. | `TOOL_NOT_ALLOWED` |
| BR-U3-01-14 | Invalid input shape fails before domain execution. | `VALIDATION_ERROR` |
| BR-U3-01-15 | Missing identity fails without retrying domain services. | `UNAUTHORIZED` |
| BR-U3-01-16 | Cross-user access fails without disclosing whether the resource exists for another user. | `FORBIDDEN` or existing 404 behavior |
| BR-U3-01-17 | Unexpected provider or repository errors are masked in voice-facing responses. | `TOOL_ERROR` |

---

## Audit Logging Rules

| Rule ID | Rule |
|---------|------|
| BR-U3-01-18 | Log one audit event for every attempted tool invocation. |
| BR-U3-01-19 | Audit event must include requestId, toolName, source, safe user identifier, status, and durationMs. |
| BR-U3-01-20 | Audit event must not include JWTs, OAuth tokens, Slack message bodies, Gmail content, raw prompt text, raw tool args, or stack traces. |
| BR-U3-01-21 | Unauthorized and forbidden events are logged with normalized reason codes only. |

---

## Existing Behavior Preservation Rules

| Rule ID | Rule |
|---------|------|
| BR-U3-01-22 | Existing direct Hono routes under `/{proxy+}` remain protected by API Gateway JWT Authorizer. |
| BR-U3-01-23 | Existing route handlers can continue using `c.get("userId")`; MCP-specific logic must not force a broad rewrite of all routes in this unit. |
| BR-U3-01-24 | Direct extension fallback remains a separate path from the primary MCP path. |
| BR-U3-01-25 | U-V3-01 may define adapter contracts and minimal dispatch shape, but full tool schema expansion belongs to U-V3-02. |
