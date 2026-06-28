# U-V3-04 Domain Entities: elevenlabs-registration-fallback

## Entity Overview

U-V3-04 is a boundary-design unit. It does not introduce a new business object such as a task or delegation record. Its domain entities describe how the voice integration chooses between the real ElevenLabs remote MCP path and browser-side fallback behavior.

## RemoteMcpRegistrationConfig

Represents the configuration that a developer or demo operator uses to register SABOROU as a remote MCP server in the ElevenLabs Dashboard.

| Field | Meaning | Notes |
|---|---|---|
| `endpointUrl` | Public SABOROU MCP endpoint registered in ElevenLabs Dashboard | Must point to a real remote MCP endpoint, not a browser pseudo REST path. |
| `transport` | `streamable_http` or `sse` | `streamable_http` is primary. `sse` is allowed only after compatibility testing blocks the primary path. |
| `schemaSource` | Published MCP/OpenAPI schema source | Must come from the U-V3-02 registry-backed schema path. |
| `authExpectation` | Authentication context expected by SABOROU tool calls | Cognito/JWT context applies to SABOROU API/MCP calls, not to browser-only clientTools. |
| `safeDisplayLabel` | Non-secret display value for setup guidance | May show endpoint host and transport, never tokens or API keys. |

## McpTransportDecision

Captures the current decision for the ElevenLabs registration transport.

| Field | Meaning |
|---|---|
| `primaryTransport` | Always `streamable_http` for U-V3-04 unless later verification blocks it. |
| `fallbackTransport` | `sse` only when real compatibility testing documents the need. |
| `decisionStatus` | `primary_selected`, `fallback_required`, or `unverified`. |
| `evidenceRef` | Link or note pointing to verification evidence in U-V3-05 or setup documentation. |
| `implementationRequired` | Whether code/infrastructure changes are needed for fallback transport. |

## BrowserClientToolFallback

Represents the extension-side fallback path registered through ElevenLabs SDK `clientTools`.

| Field | Meaning | Notes |
|---|---|---|
| `toolName` | Browser callback name such as `saborou_get_tasks` | Mirrors MCP tool names for UX continuity, but is not the remote MCP registration. |
| `fallbackApiClient` | Extension API client that calls SABOROU Hono routes | Must use authenticated Cognito token handling already owned by extension auth. |
| `fallbackMode` | `client_tools` or `hono_direct` | Both are fallback/demo resilience paths. |
| `safeError` | User-safe error summary returned to the side panel or agent callback | Must not contain tokens, raw headers, stack traces, or internal endpoint details. |

## FallbackInvocationResult

Represents the outcome of a voice-triggered action from either the primary remote MCP path or a fallback path.

| Field | Meaning |
|---|---|
| `source` | `remote_mcp`, `client_tools`, or `hono_direct`. |
| `toolName` | The SABOROU action requested. |
| `status` | `success`, `safe_failure`, or `unconfigured`. |
| `safeMessage` | Bounded response suitable for voice/UI display. |
| `diagnosticCode` | Non-secret code for troubleshooting, such as `MCP_REGISTRATION_MISSING` or `FALLBACK_API_UNAVAILABLE`. |

## RegistrationSetupArtifact

Represents the generated documentation or configuration output used during demo setup.

| Field | Meaning |
|---|---|
| `dashboardTransport` | Transport value to choose in ElevenLabs Dashboard. |
| `dashboardEndpoint` | Endpoint value to copy into Dashboard. |
| `fallbackExplanation` | Human-readable note explaining when extension fallback is used. |
| `verificationChecklistRef` | Pointer to U-V3-05 real verification steps. |
| `redactionPolicy` | Statement that secrets, JWTs, ElevenLabs API keys, Slack tokens, and Google tokens are excluded. |

## SafeConfigView

Represents configuration surfaced in the extension or setup guide.

Allowed fields:
- transport choice
- endpoint host or redacted URL
- fallback enabled/disabled state
- setup status
- non-secret diagnostic code

Forbidden fields:
- Cognito JWT
- ElevenLabs API key
- Slack bot token or user token
- Google OAuth token
- raw Authorization headers
- raw AgentCore or API Gateway signed request details

## Entity Relationships

- `RemoteMcpRegistrationConfig` owns the primary Dashboard registration values.
- `McpTransportDecision` determines whether `RemoteMcpRegistrationConfig.transport` remains `streamable_http` or moves to conditional `sse`.
- `BrowserClientToolFallback` is independent from `RemoteMcpRegistrationConfig` and must not be described as the primary remote MCP server.
- `FallbackInvocationResult` normalizes primary and fallback outcomes for UI and demo troubleshooting.
- `RegistrationSetupArtifact` and `SafeConfigView` expose only non-secret operational state.
