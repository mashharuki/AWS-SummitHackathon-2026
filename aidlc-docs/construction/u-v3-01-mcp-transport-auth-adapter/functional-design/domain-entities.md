# Domain Entities - U-V3-01 mcp-transport-auth-adapter

**作成日**: 2026-06-16
**Unit**: U-V3-01 mcp-transport-auth-adapter

---

## Entity Summary

| Entity | Purpose |
|--------|---------|
| `McpInvocation` | Represents a single tool call entering SABOROU through the MCP path. |
| `McpCallerIdentity` | Represents the authenticated caller and resolved SABOROU user. |
| `McpToolContext` | Carries user identity, request metadata, approval state, and source into tool execution. |
| `McpAuthorizationDecision` | Represents allow/deny outcome before resource access. |
| `McpAuditEvent` | Safe audit record for tool-call logging. |
| `McpAdapterError` | Safe error shape returned to the voice agent or fallback client. |

---

## McpInvocation

```typescript
type McpInvocation = {
  requestId: string;
  toolName: string;
  args: unknown;
  source: "agentcore" | "extension-fallback";
  receivedAt: string;
};
```

**Rules**:

- `requestId` is generated or propagated for every invocation.
- `toolName` is not trusted until checked against the runtime allowlist.
- `args` must remain untrusted until validated by the tool-specific schema.
- `source` is metadata only; it does not prove user authorization.

---

## McpCallerIdentity

```typescript
type McpCallerIdentity = {
  userId: string;
  subject: string;
  issuer: string;
  audience: string;
  claims: Record<string, unknown>;
  resolvedBy: "agentcore-custom-jwt" | "api-gateway-jwt";
};
```

**Rules**:

- `userId` is derived from a verified Cognito subject.
- `subject` and `userId` must match the configured Cognito identity rule unless a future mapping table is explicitly designed.
- IAM role identity can authenticate the Gateway-to-service hop, but cannot become `userId`.
- Claims are available for authorization decisions, but tokens are never logged.

---

## McpToolContext

```typescript
type McpToolContext = {
  userId: string;
  requestId: string;
  source: "agentcore" | "extension-fallback";
  humanApproved?: boolean;
  startedAt: string;
};
```

**Rules**:

- All user-scoped repositories receive `userId` from `McpToolContext`.
- Direct route handlers continue using `c.get("userId")` from existing `authMiddleware`.
- Side-effect approval is carried as explicit metadata, not inferred from natural language alone.

---

## McpAuthorizationDecision

```typescript
type McpAuthorizationDecision =
  | { allowed: true; userId: string; reason: "identity-resolved" }
  | { allowed: false; statusCode: 401 | 403; code: string; safeMessage: string };
```

**Rules**:

- Missing or invalid identity returns 401.
- Valid identity without permission for a resource returns 403 or 404 depending on existing route semantics.
- Cross-user resource access must not reveal the other resource owner's data.

---

## McpAuditEvent

```typescript
type McpAuditEvent = {
  requestId: string;
  toolName: string;
  userIdHash: string;
  source: "agentcore" | "extension-fallback";
  status: "success" | "validation_error" | "unauthorized" | "forbidden" | "tool_error";
  durationMs: number;
};
```

**Rules**:

- Audit events include no JWTs, OAuth tokens, Slack message body, Gmail content, prompt text, or full tool arguments.
- `userIdHash` or another safe stable identifier is used instead of raw tokens.
- Error status is normalized for troubleshooting without leaking internals.

---

## McpAdapterError

```typescript
type McpAdapterError = {
  ok: false;
  code: "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_ERROR" | "TOOL_NOT_ALLOWED" | "TOOL_ERROR";
  message: string;
  requestId: string;
};
```

**Rules**:

- Voice-facing errors are short and safe to read aloud.
- Internal stack traces, AWS ARNs, secrets, tokens, and raw provider responses are excluded.
