# NFR Design Patterns - U-V3-01 mcp-transport-auth-adapter

**作成日**: 2026-06-17 JST
**Unit**: U-V3-01 mcp-transport-auth-adapter
**ステータス**: Review Required

---

## Pattern Summary

| Pattern ID | Pattern | NFRs | Security Rules |
|------------|---------|------|----------------|
| NFRP-U3-01-01 | Verified Identity Gate | S1, S2, S3 | SECURITY-08, SECURITY-12 |
| NFRP-U3-01-02 | Fail-Closed Adapter Pipeline | S5, R1 | SECURITY-11, SECURITY-15 |
| NFRP-U3-01-03 | Safe Audit Event Envelope | S4, O1 | SECURITY-02, SECURITY-03, SECURITY-14 |
| NFRP-U3-01-04 | Route Preservation Boundary | S3, A1 | SECURITY-08, SECURITY-11 |
| NFRP-U3-01-05 | Schema-First Adapter Input | S5, T1 | SECURITY-05, SECURITY-13 |
| NFRP-U3-01-06 | Least-Privilege Gateway Hop | S1, S2 | SECURITY-06, SECURITY-08 |
| NFRP-U3-01-07 | Safe Error Mapper | S4, S5, R1 | SECURITY-09, SECURITY-15 |
| NFRP-U3-01-08 | Lean Evidence Lock | T1, M1 | SECURITY-11, SECURITY-13 |
| NFRP-U3-01-09 | Adapter Latency Budget | P1, O1 | SECURITY-14 |

---

## NFRP-U3-01-01: Verified Identity Gate

**Intent**: User-scoped resource access is impossible until a Cognito-backed user identity is resolved.

**Design**:

1. Accept raw MCP request metadata.
2. Resolve identity through `McpIdentityResolver`.
3. Require verified Cognito subject, issuer, audience, and expiration.
4. Build `McpToolContext` only after identity resolution succeeds.
5. Pass `McpToolContext.userId` to all downstream domain services.

**Forbidden**:

- Mapping `GATEWAY_IAM_ROLE` directly to `userId`.
- Reading userId from unverified tool args.
- Trusting natural-language conversation content as identity.

**Verification**:

- Unit test: IAM-only request returns `UNAUTHORIZED`.
- Unit test: invalid audience/issuer returns `UNAUTHORIZED`.
- Lean proof: `iam_role_does_not_resolve_user`, `precheck_rejects_iam_role`.

---

## NFRP-U3-01-02: Fail-Closed Adapter Pipeline

**Intent**: Any uncertainty blocks execution.

**Pipeline Order**:

1. RequestId creation.
2. Identity resolution.
3. Tool allowlist check.
4. Tool input validation.
5. Human approval check for side-effect tools.
6. User-scoped domain dispatch.
7. Safe result/error mapping.
8. Safe audit event emission.

**Fail-Closed Mapping**:

| Failure | Result |
|---------|--------|
| Missing/invalid identity | `UNAUTHORIZED` |
| Unknown tool | `TOOL_NOT_ALLOWED` |
| Invalid args | `VALIDATION_ERROR` |
| Missing side-effect approval | `FORBIDDEN` |
| Cross-user resource | existing 404 semantics or `FORBIDDEN` |
| Unexpected exception | `TOOL_ERROR` |

**Verification**:

- Unit tests for each failure branch.
- Route integration tests proving no domain service is called before precheck.

---

## NFRP-U3-01-03: Safe Audit Event Envelope

**Intent**: Meet logging requirements without leaking secrets or user content.

**Audit Shape**:

```typescript
type SafeMcpAuditEvent = {
  requestId: string;
  toolName: string;
  source: "agentcore" | "extension-fallback";
  userIdHash: string;
  status: "success" | "validation_error" | "unauthorized" | "forbidden" | "tool_error";
  durationMs: number;
};
```

**Redaction Rule**:

The audit type must not contain fields capable of storing:

- JWT
- OAuth token
- Slack/Gmail message body
- prompt text
- raw tool args
- stack trace
- provider secret

**Verification**:

- Unit test snapshots assert forbidden keys are absent.
- Lean proof: `audit_independent_of_secret_and_args`.
- CloudWatch Logs Insights query in Build/Test checks status counts by `toolName`.

---

## NFRP-U3-01-04: Route Preservation Boundary

**Intent**: Existing browser/extension API behavior remains protected while MCP path is introduced.

**Design**:

- Existing `/{proxy+}` HTTP API route remains JWT-authorized.
- Existing `authMiddleware` remains the direct API identity resolver.
- MCP-specific adapter logic is introduced separately from direct route handlers.
- Public exceptions remain explicit: `/health`, OAuth callback routes.

**Rejected Pattern**:

- Making broad `/{proxy+}` unauthenticated to make AgentCore calls easier.

**Verification**:

- Existing route tests still return 401 without JWT.
- CDK assertions confirm main route keeps JWT authorizer.
- No wildcard public route is introduced.

---

## NFRP-U3-01-05: Schema-First Adapter Input

**Intent**: Untrusted MCP args are validated before use.

**Design**:

- Tool name is checked before dispatch.
- Args are validated by tool-specific schema before domain execution.
- U-V3-01 defines the validation slot; U-V3-02 expands concrete schemas.

**Verification**:

- Unknown tool rejected before args inspection.
- Invalid args rejected before domain service call.
- Tool registry integration point has tests.

---

## NFRP-U3-01-06: Least-Privilege Gateway Hop

**Intent**: AgentCore can invoke only what is necessary, and its service identity is not confused with user identity.

**Design**:

- IAM policy remains scoped to the intended API/adapter target.
- Wildcards are documented only when API Gateway route ARN structure requires them.
- Trust policy remains scoped to AgentCore service principal.

**Verification**:

- CDK assertion checks no wildcard actions.
- CDK assertion checks execute-api resource is scoped to the SABOROU API ID or adapter target.
- cdk-nag suppression, if required, states the route-level wildcard reason.

---

## NFRP-U3-01-07: Safe Error Mapper

**Intent**: Voice-facing and API-facing errors are actionable but non-sensitive.

**Design**:

- Internal errors are mapped to stable codes.
- Messages are short enough for voice output.
- Stack traces and AWS/internal provider details are logged only in safe, redacted form and never returned to the caller.

**Verification**:

- Error tests assert no stack trace, ARN, token-like value, or internal path in response.
- Unexpected exception test returns `TOOL_ERROR`.

---

## NFRP-U3-01-08: Lean Evidence Lock

**Intent**: Keep implementation aligned with the formally verified model.

**Design**:

- The Lean proof stays in the repo as design evidence.
- Code Generation must map TypeScript functions to Lean model concepts:
  - `resolveIdentity`
  - `precheck`
  - `canAccessResource`
  - `safeAudit`
- If implementation weakens a proved invariant, update both Lean model and review before proceeding.

**Verification**:

```bash
lean aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/formal-verification/McpTransportAuthAdapter.lean
```

Build/Test must include this command or document manual verification.

---

## NFRP-U3-01-09: Adapter Latency Budget

**Intent**: Keep security precheck cheap enough for real-time voice flow.

**Design**:

- Identity/allowlist/approval checks are in-memory or request-local.
- Downstream service time is measured separately from adapter precheck time.
- Audit event includes `durationMs`.

**Target**:

- Adapter precheck p95 under 200 ms for read tools, excluding downstream network/database/AI work.

**Verification**:

- Unit or integration timing test with mocked downstream services.
- CloudWatch log query can compute p95 by status/tool in real environment.

---

## Security Compliance Summary

| Rule | Design Status | Notes |
|------|---------------|-------|
| SECURITY-02 | Compliant by design | Safe Audit Event Envelope plus Infrastructure Design logging requirements. |
| SECURITY-03 | Compliant by design | Structured event shape and redaction rules defined. |
| SECURITY-05 | Compliant by design | Schema-first adapter input pattern defined; concrete schemas expand in U-V3-02. |
| SECURITY-06 | Compliant by design | Least-Privilege Gateway Hop pattern requires CDK assertions. |
| SECURITY-08 | Compliant by design | Verified Identity Gate and Route Preservation Boundary address user authorization. |
| SECURITY-09 | Compliant by design | Safe Error Mapper prevents internal detail exposure. |
| SECURITY-11 | Compliant by design | Security-critical logic isolated in dedicated components. |
| SECURITY-12 | Compliant by design | Cognito remains identity source and JWT validation is required. |
| SECURITY-13 | Compliant by design | Schema validation and auditability patterns defined. |
| SECURITY-14 | Compliant by design | Audit status and duration fields support monitoring/alerting. |
| SECURITY-15 | Compliant by design | Fail-Closed Adapter Pipeline defined. |

**Blocking Findings**: None.
