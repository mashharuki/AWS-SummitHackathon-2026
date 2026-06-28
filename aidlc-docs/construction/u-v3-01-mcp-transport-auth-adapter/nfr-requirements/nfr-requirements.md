# NFR Requirements - U-V3-01 mcp-transport-auth-adapter

**作成日**: 2026-06-17 JST
**Unit**: U-V3-01 mcp-transport-auth-adapter
**ステータス**: Review Required

---

## NFR Summary

| ID | Category | Requirement | Priority |
|----|----------|-------------|----------|
| NFR-U3-01-S1 | Security | MCP calls must resolve a verified Cognito-backed `userId` before any user-scoped resource access. | Critical |
| NFR-U3-01-S2 | Security | IAM role evidence from AgentCore must not be accepted as user authorization. | Critical |
| NFR-U3-01-S3 | Security | Existing Hono API routes must remain protected by Cognito JWT Authorizer. | Critical |
| NFR-U3-01-S4 | Security | Tool-call logs must exclude tokens, raw args, message bodies, prompts, and provider secrets. | Critical |
| NFR-U3-01-S5 | Security | Adapter must fail closed on identity, validation, allowlist, or approval failures. | Critical |
| NFR-U3-01-P1 | Performance | Adapter overhead for read-tool precheck should stay below 200 ms p95 excluding downstream business logic. | High |
| NFR-U3-01-R1 | Reliability | Every MCP invocation must produce either a normalized success or a safe structured error. | High |
| NFR-U3-01-A1 | Availability | Existing direct Hono fallback must remain usable if MCP path is unavailable. | High |
| NFR-U3-01-O1 | Observability | Every attempted tool invocation must emit a safe audit event with requestId, toolName, status, duration, source, and safe user identifier. | Critical |
| NFR-U3-01-T1 | Testability | Unit, integration, CDK, and Lean verification evidence must cover the adapter security invariants. | Critical |
| NFR-U3-01-M1 | Maintainability | Security-critical adapter, identity resolver, and audit logic must be isolated from route handlers. | High |

---

## Security Requirements

### NFR-U3-01-S1: Verified User Identity

MCP adapter execution must not access tasks, Slack, Google, or user records until a verified Cognito-backed `userId` is resolved.

**Acceptance Criteria**:

- Missing identity returns `UNAUTHORIZED`.
- Invalid issuer, audience, expiration, or subject returns `UNAUTHORIZED`.
- Resolved identity is represented as an explicit `McpToolContext.userId`.
- Existing `authMiddleware` behavior for browser/extension direct API calls is preserved.

### NFR-U3-01-S2: IAM Is Not User Authorization

AgentCore `GATEWAY_IAM_ROLE` can authenticate a service-to-service hop, but cannot authorize access to user-scoped resources.

**Acceptance Criteria**:

- IAM-only calls fail before tool dispatch.
- IAM role identity is never mapped directly to `userId`.
- Lean proof `iam_role_does_not_resolve_user` and `precheck_rejects_iam_role` remain representative of implementation behavior.

### NFR-U3-01-S3: Existing JWT Routes Preserved

Existing direct Hono routes under the API Gateway `/{proxy+}` JWT authorizer must remain protected.

**Acceptance Criteria**:

- No broad unauthenticated `/{proxy+}` route is added.
- OAuth callback and health public routes remain explicitly scoped exceptions.
- Direct extension fallback continues to send Cognito JWT.

### NFR-U3-01-S4: Sensitive Data Exclusion From Logs

Logs and audit events must not include JWTs, OAuth tokens, Slack/Gmail bodies, prompt text, raw tool args, stack traces, or provider secrets.

**Acceptance Criteria**:

- Audit payload includes only requestId, toolName, source, normalized status, durationMs, and safe user identifier or hash.
- Production errors do not expose internal paths, AWS ARNs, stack traces, or tokens.
- Lean proof `audit_independent_of_secret_and_args` remains representative of implementation behavior.

### NFR-U3-01-S5: Fail-Closed Defaults

All identity, allowlist, validation, approval, or unexpected adapter errors must deny execution rather than continue.

**Acceptance Criteria**:

- Unknown tool returns `TOOL_NOT_ALLOWED`.
- Invalid arguments return `VALIDATION_ERROR`.
- Missing identity returns `UNAUTHORIZED`.
- Cross-user access returns existing 404 semantics or `FORBIDDEN` without data disclosure.
- Unexpected errors return safe `TOOL_ERROR`.

---

## Performance Requirements

### NFR-U3-01-P1: Adapter Precheck Latency

Adapter precheck should add less than 200 ms p95 latency for read tools, excluding downstream DynamoDB, Slack, Google, Bedrock, or AgentCore network latency.

**Measurement**:

- Measure requestId assignment, identity resolution, allowlist lookup, approval check, and audit event creation.
- Capture durationMs in safe audit event.

---

## Reliability And Availability Requirements

### NFR-U3-01-R1: Normalized Result Shape

Every MCP invocation must return either normalized JSON success or `McpAdapterError`.

**Acceptance Criteria**:

- No uncaught exception is returned to the voice agent.
- Adapter errors include `code`, safe `message`, and `requestId`.
- Downstream failures are masked and logged with safe status.

### NFR-U3-01-A1: Fallback Preservation

The existing browser/extension direct Hono fallback must remain available while MCP transport evolves.

**Acceptance Criteria**:

- Existing JWT-authenticated direct API tests continue passing.
- U-V3-01 changes do not require removing extension fallback code.
- MCP failure can be diagnosed separately from Hono fallback failure.

---

## Observability Requirements

### NFR-U3-01-O1: Safe Tool-Call Audit Event

Every attempted MCP invocation must emit one safe audit event.

**Required Fields**:

- `requestId`
- `toolName`
- `source`
- safe user identifier or hash
- `status`
- `durationMs`

**Forbidden Fields**:

- raw JWT
- OAuth token
- Slack/Gmail message body
- full prompt text
- raw tool args
- stack trace
- provider secret

---

## Testability Requirements

### NFR-U3-01-T1: Required Evidence

U-V3-01 implementation must include:

- Unit tests for identity resolution.
- Unit tests for IAM-only rejection.
- Unit tests for unknown tool rejection.
- Unit tests for side-effect approval precheck.
- Unit tests for safe audit event redaction.
- Integration tests proving existing Hono JWT routes still require JWT.
- CDK tests covering any API Gateway, IAM, AgentCore target, or logging changes.
- Lean proof command remains executable:

```bash
lean aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/formal-verification/McpTransportAuthAdapter.lean
```

---

## Maintainability Requirements

### NFR-U3-01-M1: Security Logic Isolation

Security-critical logic must be isolated into adapter/identity/audit modules instead of scattered across route handlers.

**Acceptance Criteria**:

- Existing route handlers are not broadly rewritten.
- Adapter identity logic has focused tests.
- Audit redaction is centralized.
- Tool registry integration point is explicit, even if full registry expansion happens in U-V3-02.

---

## Security Baseline Compliance

| Rule | Status | Rationale |
|------|--------|-----------|
| SECURITY-01 | N/A | U-V3-01 does not create new data stores. Existing storage encryption is outside this unit. |
| SECURITY-02 | Applicable | API Gateway / AgentCore path logging and audit event requirements are captured in NFR-U3-01-O1 and later Infrastructure Design. |
| SECURITY-03 | Applicable | Structured app logging with requestId/status/duration and sensitive-data exclusion is required. |
| SECURITY-04 | N/A | U-V3-01 does not add HTML-serving endpoints. |
| SECURITY-05 | Applicable | Tool args and adapter input must be schema validated before dispatch. |
| SECURITY-06 | Applicable | AgentCore/API Gateway/IAM changes must use least privilege; wildcard exceptions require documentation. |
| SECURITY-07 | N/A | U-V3-01 does not add VPC, subnet, or security group configuration. |
| SECURITY-08 | Applicable | Core requirement: userId must be Cognito-backed and object-level access must be scoped. |
| SECURITY-09 | Applicable | Error responses must not reveal stack traces, internals, or provider details. |
| SECURITY-10 | Applicable | Lean toolchain and package lock evidence must be preserved in build/test instructions. |
| SECURITY-11 | Applicable | Security-critical logic must be isolated; fail-closed and abuse cases are documented. |
| SECURITY-12 | Applicable | JWT validation and credential non-exposure are required; Cognito remains source of identity. |
| SECURITY-13 | Applicable | Untrusted tool input must be validated; audit events support critical data-change traceability. |
| SECURITY-14 | Applicable | Auth/authorization failures must be observable and alertable in later NFR/Infrastructure Design. |
| SECURITY-15 | Applicable | Adapter must fail closed and return safe errors. |

**Blocking Findings**: None at NFR Requirements stage. All applicable Security Baseline rules are captured as requirements for NFR Design, Infrastructure Design, Code Generation, and Build/Test.
