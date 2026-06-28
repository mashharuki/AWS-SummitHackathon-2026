# Logical Components - U-V3-01 mcp-transport-auth-adapter

**作成日**: 2026-06-17 JST
**Unit**: U-V3-01 mcp-transport-auth-adapter
**ステータス**: Review Required

---

## Component Summary

| Component | Responsibility | Package Boundary |
|-----------|----------------|------------------|
| `McpAdapterEntry` | Normalize MCP invocation and establish requestId/source/timing. | `pkgs/backend` |
| `McpIdentityResolver` | Resolve verified Cognito-backed `userId`; reject IAM-only identity. | `pkgs/backend` |
| `McpPrecheckPipeline` | Run identity, allowlist, validation, and approval checks in order. | `pkgs/backend` |
| `McpToolContextFactory` | Build immutable tool context for domain dispatch. | `pkgs/backend` |
| `McpSafeAuditLogger` | Emit redacted structured audit event. | `pkgs/backend` |
| `McpSafeErrorMapper` | Convert failures into safe voice/API errors. | `pkgs/backend` |
| `ExistingAuthMiddleware` | Preserve direct API JWT behavior for browser/extension routes. | `pkgs/backend` existing |
| `AgentCoreGatewayRoleBoundary` | Scope AgentCore service-hop permissions without user authorization. | `pkgs/cdk` |
| `RouteAuthorizerBoundary` | Preserve JWT authorizer on existing API Gateway routes. | `pkgs/cdk` |
| `LeanVerificationEvidence` | Preserve mathematical proof of core invariants. | `aidlc-docs` |

---

## Logical Flow

### MCP Path

1. `McpAdapterEntry` receives raw invocation.
2. `McpIdentityResolver` resolves verified Cognito-backed user identity.
3. `McpPrecheckPipeline` checks allowlist, schema, and approval.
4. `McpToolContextFactory` creates `McpToolContext`.
5. Domain service executes with `userId` scoped context.
6. `McpSafeErrorMapper` normalizes failures.
7. `McpSafeAuditLogger` emits one safe audit event.

### Direct Hono Fallback Path

1. API Gateway JWT Authorizer validates Cognito JWT.
2. Existing `authMiddleware` reads `requestContext.authorizer.jwt.claims.sub`.
3. Existing Hono route handler uses `c.get("userId")`.
4. No MCP-specific IAM identity is involved.

---

## Component Details

### McpAdapterEntry

**Inputs**:

- raw MCP request
- source metadata
- arrival timestamp

**Outputs**:

- normalized invocation
- requestId

**NFR Patterns**:

- Fail-Closed Adapter Pipeline
- Adapter Latency Budget

---

### McpIdentityResolver

**Inputs**:

- verified Gateway/Cognito request context
- expected issuer/audience configuration

**Outputs**:

- `McpCallerIdentity`
- `UNAUTHORIZED` on failure

**NFR Patterns**:

- Verified Identity Gate
- Least-Privilege Gateway Hop
- Lean Evidence Lock

**Invariant**:

IAM role evidence is never converted into SABOROU `userId`.

---

### McpPrecheckPipeline

**Inputs**:

- normalized invocation
- resolved identity
- tool registry lookup
- tool schema validator

**Outputs**:

- `McpToolContext`
- safe adapter error

**NFR Patterns**:

- Fail-Closed Adapter Pipeline
- Schema-First Adapter Input

**Ordering Constraint**:

Identity check must run before domain dispatch. Tool allowlist must run before args are trusted. Approval must run before side-effect dispatch.

---

### McpToolContextFactory

**Inputs**:

- requestId
- userId
- source
- human approval metadata

**Outputs**:

- immutable `McpToolContext`

**NFR Patterns**:

- Verified Identity Gate
- Route Preservation Boundary

---

### McpSafeAuditLogger

**Inputs**:

- requestId
- toolName
- source
- safe user identifier or hash
- normalized status
- durationMs

**Outputs**:

- structured CloudWatch log event

**NFR Patterns**:

- Safe Audit Event Envelope
- Adapter Latency Budget

**Forbidden Inputs**:

- raw tool args
- JWT/OAuth tokens
- message bodies
- prompt text
- provider secrets

---

### McpSafeErrorMapper

**Inputs**:

- adapter error
- validation error
- unexpected exception

**Outputs**:

- stable error code
- safe short message
- requestId

**NFR Patterns**:

- Safe Error Mapper
- Fail-Closed Adapter Pipeline

---

### ExistingAuthMiddleware

**Responsibility**:

Keeps direct API behavior stable by continuing to extract `userId` from API Gateway JWT claims.

**NFR Patterns**:

- Route Preservation Boundary

**Constraint**:

Do not extend this middleware to trust IAM-only Gateway calls as `userId`.

---

### AgentCoreGatewayRoleBoundary

**Responsibility**:

Provides service-hop permission for AgentCore while remaining distinct from user authorization.

**NFR Patterns**:

- Least-Privilege Gateway Hop

**Infrastructure Design Inputs**:

- execute-api scope
- AgentCore service principal trust policy
- cdk-nag exception rationale if route wildcard is necessary

---

### RouteAuthorizerBoundary

**Responsibility**:

Preserves Cognito JWT authorizer on existing `/{proxy+}` routes.

**NFR Patterns**:

- Route Preservation Boundary

**Infrastructure Design Inputs**:

- route authorizer assertions
- explicit public route allowlist

---

### LeanVerificationEvidence

**Responsibility**:

Keeps the formally verified model executable as regression evidence.

**NFR Patterns**:

- Lean Evidence Lock

**Verification Command**:

```bash
lean aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/formal-verification/McpTransportAuthAdapter.lean
```

---

## Test Matrix

| Component | Required Tests |
|-----------|----------------|
| `McpIdentityResolver` | Cognito success, IAM-only rejection, invalid token rejection. |
| `McpPrecheckPipeline` | Unknown tool, invalid args, missing approval, valid read tool. |
| `McpSafeAuditLogger` | Required fields present, forbidden fields absent. |
| `McpSafeErrorMapper` | Safe messages for unauthorized, forbidden, validation, unknown tool, unexpected error. |
| `ExistingAuthMiddleware` | Existing no-JWT 401 and valid-JWT userId extraction tests remain passing. |
| `AgentCoreGatewayRoleBoundary` | CDK assertion: no wildcard actions; scoped resources or documented exception. |
| `RouteAuthorizerBoundary` | CDK assertion: main route keeps JWT authorizer; public routes are explicit. |
| `LeanVerificationEvidence` | `lean` command exits 0; no `sorry`, `axiom`, `admit`, or `unsafe`. |

---

## Infrastructure Design Inputs

Infrastructure Design must choose the exact route/target pattern, but it must preserve these logical constraints:

- Existing `/{proxy+}` route remains JWT-authorized.
- AgentCore service-hop permission is least privilege.
- MCP adapter can access verified user identity without trusting IAM as user identity.
- API Gateway or AgentCore access logs are configured according to SECURITY-02.
- CloudWatch log retention and alertability are addressed according to SECURITY-14.
