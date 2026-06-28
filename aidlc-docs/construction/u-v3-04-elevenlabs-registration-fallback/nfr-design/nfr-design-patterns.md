# U-V3-04 NFR Design Patterns: elevenlabs-registration-fallback

## Pattern 1: Remote MCP Primary Registration

**Purpose**: Make ElevenLabs Dashboard remote MCP registration the primary integration path.

**Design**:
- Setup artifacts present `streamable_http` as the primary Dashboard transport.
- The registered endpoint must be a real SABOROU remote MCP endpoint backed by U-V3-01 and U-V3-02 behavior.
- Browser `clientTools` are never used as evidence of primary remote MCP success.

**NFRs addressed**:
- NFR-U-V3-04-S2
- NFR-U-V3-04-R1
- NFR-U-V3-04-M1

**Security Baseline**:
- SECURITY-08
- SECURITY-11
- SECURITY-13

## Pattern 2: Conditional SSE Fallback Gate

**Purpose**: Prevent premature `sse` bridge implementation while keeping a clean escape path if real compatibility requires it.

**Design**:
- The default transport decision is `streamable_http`.
- `sse` remains a documented fallback option with status `fallback_required` only after U-V3-05 records compatibility evidence.
- Any future `sse` bridge must front the same MCP Tool Adapter and Tool Registry.
- Infrastructure Design is reopened only if `sse` requires new endpoint, CDK output, IAM, or access logging resources.

**NFRs addressed**:
- NFR-U-V3-04-R1
- NFR-U-V3-04-M1
- NFR-U-V3-04-T1

**Security Baseline**:
- SECURITY-02
- SECURITY-06
- SECURITY-11
- SECURITY-15

## Pattern 3: Explicit Fallback Mode Boundary

**Purpose**: Keep browser fallback useful without misrepresenting it as AgentCore remote MCP.

**Design**:
- Extension status values distinguish `remote_mcp_primary`, `remote_mcp_unverified`, `client_tools_fallback`, `hono_direct_fallback`, and `unconfigured`.
- Direct API fallback code is named and documented as fallback behavior.
- Pseudo `/mcp/tools/saborou_*` wording is removed or labeled as legacy/invalid.
- Fallback success never marks remote MCP verification as passed.

**NFRs addressed**:
- NFR-U-V3-04-S2
- NFR-U-V3-04-R1
- NFR-U-V3-04-M1
- NFR-U-V3-04-T1

**Security Baseline**:
- SECURITY-08
- SECURITY-11
- SECURITY-15

## Pattern 4: Secret-Safe Configuration View

**Purpose**: Allow demo operators to inspect setup state without exposing credentials.

**Design**:
- Configuration display is allowlist-based.
- Allowed fields include transport, endpoint host or redacted URL, fallback enabled state, verification state, and diagnostic code.
- Forbidden fields include Cognito JWT, ElevenLabs API key, Slack token, Google token, raw Authorization header, and signed AWS request details.
- Redaction happens before values reach browser-visible UI state or logs.

**NFRs addressed**:
- NFR-U-V3-04-S1
- NFR-U-V3-04-O1

**Security Baseline**:
- SECURITY-03
- SECURITY-09
- SECURITY-12
- SECURITY-15

## Pattern 5: Server-Side Authorization Preservation

**Purpose**: Ensure fallback does not weaken user-scoped authorization.

**Design**:
- Browser fallback calls use the existing authenticated SABOROU API path.
- Cognito token validation, object-level authorization, schema validation, and side-effect approval remain server-side.
- Browser state and ElevenLabs conversation state are never accepted as authority for tasks, Slack, or Google resources.
- Missing/expired auth maps to `FALLBACK_AUTH_REQUIRED` and stops the operation.

**NFRs addressed**:
- NFR-U-V3-04-S3
- NFR-U-V3-04-T1

**Security Baseline**:
- SECURITY-05
- SECURITY-08
- SECURITY-11
- SECURITY-15

## Pattern 6: Bounded Failure And Retry Policy

**Purpose**: Keep user feedback prompt and avoid duplicate side effects.

**Design**:
- Setup state evaluation is local and must not depend on remote verification during normal panel render.
- Fallback invocation errors return immediately with safe diagnostic codes.
- No unbounded retries are introduced.
- Side-effect fallbacks are not retried automatically unless a later idempotency design is approved.

**NFRs addressed**:
- NFR-U-V3-04-P1
- NFR-U-V3-04-R1

**Security Baseline**:
- SECURITY-11
- SECURITY-15

## Pattern 7: Safe Diagnostic Taxonomy

**Purpose**: Make setup and fallback troubleshooting precise without exposing internals.

**Design**:
- Use stable diagnostic codes:
  - `MCP_REGISTRATION_MISSING`
  - `MCP_TRANSPORT_UNVERIFIED`
  - `MCP_PRIMARY_UNAVAILABLE`
  - `FALLBACK_AUTH_REQUIRED`
  - `FALLBACK_API_UNAVAILABLE`
  - `MCP_SCHEMA_MISMATCH`
- Diagnostics can be shown in UI and docs.
- Raw external errors, stack traces, response bodies, and credentials are excluded.
- U-V3-05 verification maps real failures to this taxonomy.

**NFRs addressed**:
- NFR-U-V3-04-S1
- NFR-U-V3-04-O1
- NFR-U-V3-04-T1

**Security Baseline**:
- SECURITY-03
- SECURITY-09
- SECURITY-14
- SECURITY-15

## Pattern 8: Registry-Backed Setup Artifact

**Purpose**: Prevent schema drift between Dashboard setup guidance and actual MCP tool contracts.

**Design**:
- Remote MCP setup instructions point to U-V3-02 registry-backed schema artifacts.
- U-V3-04 does not duplicate tool schemas in extension code or docs.
- Code Generation includes a documentation/test lock that prevents reintroducing pseudo remote MCP wording.

**NFRs addressed**:
- NFR-U-V3-04-M1
- NFR-U-V3-04-T1

**Security Baseline**:
- SECURITY-10
- SECURITY-13

## Pattern 9: Verification Handoff Contract

**Purpose**: Keep U-V3-04 implementation aligned with U-V3-05 real verification.

**Design**:
- U-V3-04 emits setup and diagnostic artifacts; U-V3-05 records real AWS/AgentCore/ElevenLabs evidence.
- `streamable_http` remains selected until verification proves otherwise.
- If verification blocks `streamable_http`, U-V3-05 creates evidence that reopens U-V3-04 Infrastructure Design for `sse`.

**NFRs addressed**:
- NFR-U-V3-04-R1
- NFR-U-V3-04-O1
- NFR-U-V3-04-M1

**Security Baseline**:
- SECURITY-02
- SECURITY-11
- SECURITY-14

## Security Compliance Summary

| Rule | Status | Design Coverage |
|---|---|---|
| SECURITY-01 Encryption | N/A | No new persistence resource is designed. |
| SECURITY-02 Access Logging | Compliant by design | Future `sse` bridge/new endpoint must reopen Infrastructure Design for logging. |
| SECURITY-03 Application Logging | Compliant | Safe diagnostic taxonomy and redaction boundaries are defined. |
| SECURITY-04 HTTP Security Headers | N/A | No new HTML-serving endpoint is designed. |
| SECURITY-05 Input Validation | Compliant | Fallback preserves existing schema-first server validation. |
| SECURITY-06 Least Privilege | Compliant by gate | Any new bridge/IAM is deferred to Infrastructure Design with least-privilege requirement. |
| SECURITY-07 Network Configuration | N/A | No network topology change is designed. |
| SECURITY-08 Access Control | Compliant | Fallback cannot bypass server-side authorization. |
| SECURITY-09 Hardening | Compliant | User-visible errors hide internals and raw responses. |
| SECURITY-10 Supply Chain | Compliant | No new dependency is required by the design. |
| SECURITY-11 Secure Design | Compliant | Primary/fallback separation and misuse-resistant retry behavior are explicit. |
| SECURITY-12 Credential Management | Compliant | Browser-visible state uses allowlisted non-secret fields. |
| SECURITY-13 Integrity | Compliant | Setup artifacts trace to registry-backed schema outputs. |
| SECURITY-14 Monitoring | Compliant by design | Diagnostic categories support U-V3-05 verification and troubleshooting. |
| SECURITY-15 Fail-Safe Defaults | Compliant | Missing config/auth/schema failure stops unsafe operations or uses safe fallback. |

## Blocking Findings

None.
