# U-V3-04 Business Logic Model: elevenlabs-registration-fallback

## Functional Boundary

U-V3-04 defines how SABOROU chooses and presents the voice tool-call path:

1. Primary: ElevenLabs Dashboard remote MCP registration using `streamable_http`.
2. Conditional transport fallback: `sse` bridge only if primary compatibility is blocked.
3. Runtime fallback: browser `clientTools` and direct Hono API calls for extension/demo resilience.

The unit does not change tool business semantics. Tool contracts remain owned by U-V3-02, authorization by U-V3-01, and `@Claude` delegation by U-V3-03.

## Flow 1: Dashboard Remote MCP Registration

1. Developer or demo operator obtains the published SABOROU MCP endpoint and registry-backed schema reference.
2. Operator registers SABOROU in ElevenLabs Dashboard as a remote MCP server.
3. Operator selects `streamable_http`.
4. ElevenLabs Agent invokes SABOROU tools through the registered remote MCP server.
5. The request reaches the same server-side MCP Tool Adapter and Tool Registry used by U-V3-01 and U-V3-02.
6. SABOROU returns a safe tool response to ElevenLabs Agent.

### Invariants

- The endpoint is a real remote MCP endpoint.
- The endpoint is not an extension pseudo path such as `/mcp/tools/saborou_get_tasks`.
- The tool list and schema come from the U-V3-02 registry.
- Server-side authorization is required before user resources are accessed.

## Flow 2: Transport Compatibility Decision

1. U-V3-04 implementation exposes `streamable_http` setup instructions and configuration first.
2. U-V3-05 performs real AWS/AgentCore/ElevenLabs verification.
3. If `streamable_http` passes, the decision remains `primary_selected`.
4. If `streamable_http` is blocked by real compatibility constraints, the decision changes to `fallback_required`.
5. Only then may an `sse` bridge be designed or enabled.

### Decision Outcomes

| Outcome | Meaning | Required Behavior |
|---|---|---|
| `primary_selected` | `streamable_http` is the active Dashboard registration path. | No `sse` bridge is required. |
| `fallback_required` | Verification blocks `streamable_http`. | Design or enable `sse` bridge to the same MCP adapter. |
| `unverified` | Real verification has not run yet. | Show setup as pending and keep browser fallback available. |

## Flow 3: Browser ClientTools Fallback

1. Extension initializes the ElevenLabs SDK client.
2. Extension registers local `clientTools` callbacks for known SABOROU actions.
3. If the Dashboard remote MCP path is not used or is unavailable during local demo, a clientTool callback can call the extension fallback API client.
4. The fallback API client sends an authenticated request to SABOROU Hono API routes.
5. Server-side authentication, authorization, validation, and approval rules remain in effect.
6. Extension returns a safe result or safe diagnostic message to the UI/voice callback.

### Invariants

- `clientTools` are local callbacks, not the remote MCP server.
- The fallback client must not claim it is AgentCore Gateway remote MCP.
- Fallback calls must preserve Cognito auth and side-effect approval behavior.
- Fallback errors must be safe for browser display.

## Flow 4: Direct Hono Demo Fallback

1. Operator or extension detects that remote MCP registration is missing, unverified, or temporarily unavailable.
2. Extension uses direct Hono fallback routes for supported demo actions.
3. The UI labels the state as fallback mode.
4. The system continues to require user authentication and approval metadata for side effects.
5. The result is displayed as fallback output, not proof of remote MCP success.

## Flow 5: Safe Configuration Display

1. Extension or setup documentation reads non-secret configuration values.
2. It displays endpoint/transport status in redacted form.
3. It displays fallback availability and next action.
4. It never displays raw credentials, JWTs, tokens, signed AWS request details, or full Authorization headers.

## Error Model

| Condition | Business Response | Safe Diagnostic Code |
|---|---|---|
| No Dashboard endpoint configured | Report setup incomplete and allow fallback if configured. | `MCP_REGISTRATION_MISSING` |
| `streamable_http` unverified | Report verification pending. | `MCP_TRANSPORT_UNVERIFIED` |
| Primary remote MCP unavailable | Use fallback if enabled, otherwise report unavailable. | `MCP_PRIMARY_UNAVAILABLE` |
| Browser fallback auth missing | Ask user to sign in again. | `FALLBACK_AUTH_REQUIRED` |
| Fallback API unavailable | Report temporary fallback failure. | `FALLBACK_API_UNAVAILABLE` |
| Tool contract mismatch | Block invocation and point to registry/schema validation. | `MCP_SCHEMA_MISMATCH` |

## Required Code Generation Consequences

- Reframe extension API client naming/comments so pseudo `/mcp/tools/...` calls are not described as AgentCore remote MCP.
- Prefer setup artifacts and docs that instruct Dashboard `streamable_http` registration.
- Preserve `clientTools` registration for fallback and UI support.
- Keep direct Hono fallback behavior available.
- Add tests or assertions proving secret redaction and pseudo path neutralization.
