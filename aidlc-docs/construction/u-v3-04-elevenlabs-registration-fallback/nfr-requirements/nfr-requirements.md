# U-V3-04 NFR Requirements: elevenlabs-registration-fallback

## Scope

This NFR assessment covers the remote MCP registration and fallback behavior required for U-V3-04:

- ElevenLabs Dashboard registration using `streamable_http` first.
- Conditional `sse` fallback only after real compatibility testing.
- Browser `clientTools` as fallback/UI support.
- Direct Hono fallback for demo resilience.
- Secret-safe setup status, browser config, and logs.

This unit does not redefine MCP tool schemas, user authorization, or Slack delegation behavior. Those remain owned by U-V3-01, U-V3-02, and U-V3-03.

## NFR-U-V3-04-S1: Secret-Safe Browser Configuration

Browser-visible setup state must never expose secrets.

Required behavior:
- Do not store or display ElevenLabs API keys in extension config.
- Do not display Cognito JWTs, Slack tokens, Google tokens, raw Authorization headers, or signed AWS request material.
- Redact endpoint values when full URLs may embed sensitive query strings or tokens.
- Ensure diagnostic messages are short, bounded, and non-secret.

Security Baseline:
- SECURITY-03
- SECURITY-09
- SECURITY-12
- SECURITY-15

Acceptance criteria:
- Extension setup UI or documentation shows only non-secret endpoint/transport/fallback status.
- Tests or review checks prove no token-like values are logged by new U-V3-04 code.
- Error strings use safe diagnostic codes such as `MCP_REGISTRATION_MISSING` or `FALLBACK_AUTH_REQUIRED`.

## NFR-U-V3-04-S2: Primary/Fallback Boundary Integrity

The system must maintain a clear boundary between the primary remote MCP path and browser fallback paths.

Required behavior:
- `streamable_http` remote MCP is the primary Dashboard registration path.
- Browser `clientTools` are not described as AgentCore remote MCP.
- Direct Hono fallback is labeled as fallback, not as successful remote MCP verification.
- Pseudo `/mcp/tools/saborou_*` AgentCore assumptions are removed or neutralized.

Security Baseline:
- SECURITY-08
- SECURITY-11
- SECURITY-15

Acceptance criteria:
- Code comments, setup text, and status names distinguish `remote_mcp_primary`, `client_tools_fallback`, and `hono_direct_fallback`.
- No UI state treats browser callback success as evidence that ElevenLabs remote MCP registration succeeded.
- Fallback calls still pass through server-side authentication and authorization.

## NFR-U-V3-04-S3: Authorization Preservation

Fallback behavior must not weaken authorization.

Required behavior:
- Extension fallback requests use the existing authenticated SABOROU API path.
- Side-effect tools continue requiring approval metadata.
- Browser state and ElevenLabs conversation state are never trusted as user authority.
- Tool input validation remains schema-first through existing backend contracts.

Security Baseline:
- SECURITY-05
- SECURITY-08
- SECURITY-11
- SECURITY-15

Acceptance criteria:
- Missing or expired Cognito auth results in safe fallback auth failure.
- Side-effect fallback calls fail closed when approval is missing.
- U-V3-04 does not introduce unauthenticated resource access.

## NFR-U-V3-04-R1: Demo Availability And Fallback Resilience

The demo must remain usable when the primary remote MCP path is unverified or temporarily unavailable.

Required behavior:
- Keep browser `clientTools` available for fallback/UI support.
- Keep direct Hono fallback usable for supported demo actions.
- Provide setup state that explains whether primary MCP, clientTools fallback, or direct Hono fallback is active.
- Avoid implementing `sse` unless real verification requires it.

Security Baseline:
- SECURITY-11
- SECURITY-15

Acceptance criteria:
- `unconfigured` and `remote_mcp_unverified` states produce actionable non-secret setup guidance.
- Primary path failure does not trigger unsafe side effects.
- Fallback mode is visibly distinct from primary remote MCP success.

## NFR-U-V3-04-P1: Latency And User Feedback

The extension must provide prompt feedback for configuration and fallback failures.

Required behavior:
- Local setup state evaluation should complete within 100 ms.
- Browser fallback invocation should preserve the existing API latency target from v3 requirements.
- User-facing failure messages should appear without waiting for repeated retries.
- Any retry behavior must be bounded and must not duplicate side effects.

Security Baseline:
- SECURITY-11
- SECURITY-15

Acceptance criteria:
- No unbounded retry loop is introduced in extension fallback logic.
- Side-effect fallback calls are not retried without explicit idempotency design.
- UI state transitions do not block on remote verification in normal panel render.

## NFR-U-V3-04-O1: Observability And Troubleshooting

The setup and fallback path must be diagnosable without leaking secrets.

Required behavior:
- Use structured safe diagnostic codes for setup and fallback failures.
- Preserve request/correlation ID handling where existing backend calls provide it.
- Document that U-V3-05 owns real remote MCP verification evidence.
- If `sse` fallback is later enabled, it must generate the same class of safe tool-call observability as the primary path.

Security Baseline:
- SECURITY-02
- SECURITY-03
- SECURITY-14

Acceptance criteria:
- Diagnostic codes distinguish missing registration, unverified transport, primary unavailable, fallback auth required, fallback API unavailable, and schema mismatch.
- Logs do not include secrets or raw external response bodies.
- Verification instructions can map observed failures to transport, auth, schema, or fallback categories.

## NFR-U-V3-04-M1: Maintainability And Documentation

The implementation must be easy to reason about during hackathon demo setup.

Required behavior:
- Keep primary and fallback concepts explicit in names, comments, and setup documentation.
- Avoid adding duplicate MCP schema definitions.
- Avoid adding new dependencies unless they directly support remote MCP setup, redaction, or testability.
- Keep `sse` implementation deferred unless compatibility evidence requires it.

Security Baseline:
- SECURITY-10
- SECURITY-13

Acceptance criteria:
- Code Generation updates docs and tests alongside extension/config changes.
- Any dependency addition is lockfile-backed and justified.
- Remote MCP registration instructions point to registry-backed schema artifacts, not duplicated tool definitions.

## NFR-U-V3-04-T1: Test Coverage

U-V3-04 must include targeted tests or documented checks for the primary/fallback boundary.

Required coverage:
- `streamable_http` is the documented primary transport.
- `sse` appears only as conditional fallback.
- Browser `clientTools` are described and tested as fallback/UI support.
- Pseudo AgentCore `/mcp/tools/saborou_*` assumptions are removed or neutralized.
- Secret redaction is enforced for setup state and errors.
- Fallback auth failure is safe.

Security Baseline:
- SECURITY-05
- SECURITY-08
- SECURITY-09
- SECURITY-10
- SECURITY-12
- SECURITY-15

Acceptance criteria:
- Extension tests cover fallback state naming and safe diagnostics.
- Documentation or snapshot tests prevent reintroducing pseudo remote MCP wording.
- Existing backend schema/authorization tests remain passing.

## Security Compliance Summary

| Rule | Status | Rationale |
|---|---|---|
| SECURITY-01 Encryption | N/A | U-V3-04 adds no new persistence store in NFR Requirements. |
| SECURITY-02 Access Logging | Compliant by requirement | Primary remote MCP and any future `sse` bridge must preserve access/audit logging; concrete implementation belongs to NFR Design/Infrastructure if resources change. |
| SECURITY-03 Application Logging | Compliant | Safe structured diagnostics and no secret logging are required. |
| SECURITY-04 HTTP Security Headers | N/A | No new HTML-serving endpoint is introduced. |
| SECURITY-05 Input Validation | Compliant | Tool input validation remains schema-first through U-V3-02; fallback cannot bypass it. |
| SECURITY-06 Least Privilege | N/A for this stage | No IAM or policy change is defined yet; if `sse` bridge or new endpoint is introduced, Infrastructure Design must enforce it. |
| SECURITY-07 Network Configuration | N/A | No VPC, subnet, or security group change is defined. |
| SECURITY-08 Access Control | Compliant | Fallback requests must preserve server-side Cognito/API authorization and object-level access control. |
| SECURITY-09 Hardening | Compliant | Setup/errors must not expose stack traces, raw responses, internals, or credentials. |
| SECURITY-10 Supply Chain | Compliant by requirement | Dependency additions are discouraged and must be lockfile-backed if required. |
| SECURITY-11 Secure Design | Compliant | Primary/fallback separation and fail-closed fallback behavior are explicit. |
| SECURITY-12 Credential Management | Compliant | Browser config/logging must exclude all ElevenLabs, Cognito, Slack, Google, and AWS signing secrets. |
| SECURITY-13 Integrity | Compliant by requirement | Registration artifacts must trace to registry-backed schema output. |
| SECURITY-14 Monitoring | Compliant by requirement | Safe diagnostic categories and future verification observability are required. |
| SECURITY-15 Fail-Safe Defaults | Compliant | Missing config, auth failure, unavailable primary path, and schema mismatch fail closed or safe fallback. |

## Blocking Findings

None.
