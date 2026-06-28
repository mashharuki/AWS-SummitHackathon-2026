# U-V3-04 Logical Components: elevenlabs-registration-fallback

## Component Overview

U-V3-04 uses existing extension, backend, CDK, and documentation boundaries. The logical components below define responsibilities for Code Generation without requiring new runtime dependencies.

## RemoteMcpSetupDescriptor

**Responsibility**: Represent the Dashboard registration values and setup state.

Inputs:
- CDK/API output for the SABOROU MCP endpoint
- registry-backed schema location
- selected transport
- verification state from setup docs or U-V3-05 handoff

Outputs:
- safe setup status
- transport label
- redacted endpoint display
- verification state

Rules:
- Default transport is `streamable_http`.
- `sse` requires compatibility evidence.
- No secret values are accepted as display fields.

## TransportDecisionGate

**Responsibility**: Decide whether the active design remains primary `streamable_http` or needs `sse` fallback.

States:
- `primary_selected`
- `unverified`
- `fallback_required`

Rules:
- `primary_selected` is the default when no blocking evidence exists.
- `fallback_required` requires U-V3-05 evidence.
- `fallback_required` reopens Infrastructure Design if new resources are needed.

## ExtensionVoiceFallbackCoordinator

**Responsibility**: Coordinate browser `clientTools` as fallback/UI support.

Inputs:
- current extension auth state
- tool callback request
- fallback API client availability
- setup status from `RemoteMcpSetupDescriptor`

Outputs:
- safe fallback invocation result
- UI state label
- safe diagnostic code

Rules:
- It must never mark fallback success as remote MCP verification success.
- It must not use browser state as user authorization.
- It must return `FALLBACK_AUTH_REQUIRED` for missing auth.

## FallbackApiClient

**Responsibility**: Call existing SABOROU Hono API routes for direct fallback.

Inputs:
- Cognito-authenticated API token from existing extension auth
- validated fallback request shape from the caller

Outputs:
- safe success payload
- safe error payload

Rules:
- It is a fallback/direct API client, not an AgentCore remote MCP client.
- It must preserve existing backend authorization, validation, and side-effect approval behavior.
- It must not build or describe pseudo AgentCore MCP paths as real remote MCP.

## SafeConfigPresenter

**Responsibility**: Produce browser-visible setup state.

Allowed output:
- transport
- endpoint host or redacted URL
- fallback enabled state
- verification state
- diagnostic code

Forbidden output:
- JWT
- ElevenLabs API key
- Slack token
- Google token
- raw Authorization header
- signed AWS request material
- raw external response body

Rules:
- Use allowlisted fields.
- Redact before values enter UI state.
- Keep messages short and actionable.

## DiagnosticCodeMapper

**Responsibility**: Normalize setup and fallback failures.

Codes:

| Code | Meaning |
|---|---|
| `MCP_REGISTRATION_MISSING` | Dashboard remote MCP endpoint/setup is missing. |
| `MCP_TRANSPORT_UNVERIFIED` | `streamable_http` setup exists but real verification has not completed. |
| `MCP_PRIMARY_UNAVAILABLE` | Primary remote MCP is expected but unavailable. |
| `FALLBACK_AUTH_REQUIRED` | Extension fallback cannot call backend without valid auth. |
| `FALLBACK_API_UNAVAILABLE` | Direct Hono fallback endpoint is unreachable or failed safely. |
| `MCP_SCHEMA_MISMATCH` | Tool contract does not match registry-backed schema. |

Rules:
- Do not expose raw errors.
- Preserve correlation/request IDs if existing backend response provides them.
- Map unknown failures to a generic safe fallback failure.

## RegistryBackedSetupArtifact

**Responsibility**: Keep setup documentation tied to U-V3-02 tool registry output.

Inputs:
- registry-backed schema artifact
- setup guide content
- transport decision

Outputs:
- Dashboard setup instructions
- fallback explanation
- verification checklist handoff

Rules:
- Do not duplicate tool schemas.
- Use registry-backed schema references.
- State that U-V3-05 owns real verification evidence.

## DocumentationAndTestLock

**Responsibility**: Prevent regression to pseudo remote MCP assumptions.

Checks:
- `streamable_http` is primary in setup docs.
- `sse` is conditional fallback only.
- `clientTools` wording says fallback/UI support.
- pseudo `/mcp/tools/saborou_*` wording is absent from primary remote MCP docs and comments.
- secret-like values are not rendered in setup snapshots or diagnostic output.

Rules:
- Prefer existing package test runners.
- Avoid new dependencies unless the check cannot be implemented with current tooling.

## Logical Interaction Summary

1. `RemoteMcpSetupDescriptor` describes safe primary setup state.
2. `TransportDecisionGate` keeps `streamable_http` selected unless U-V3-05 evidence requires `sse`.
3. `ExtensionVoiceFallbackCoordinator` keeps browser `clientTools` available as fallback/UI support.
4. `FallbackApiClient` calls existing authenticated Hono APIs when fallback is active.
5. `SafeConfigPresenter` renders only non-secret setup and fallback state.
6. `DiagnosticCodeMapper` normalizes failures for UI and verification troubleshooting.
7. `RegistryBackedSetupArtifact` keeps setup documentation tied to the U-V3-02 schema source.
8. `DocumentationAndTestLock` prevents regression in Code Generation.

## Implementation Boundary

U-V3-04 Code Generation should modify extension/config/docs/tests only as needed to implement these components. It should not create a new transport bridge unless Infrastructure Design first determines that `sse` is required by real compatibility evidence.
