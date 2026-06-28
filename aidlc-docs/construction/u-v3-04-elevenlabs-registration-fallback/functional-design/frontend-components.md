# U-V3-04 Frontend Components: elevenlabs-registration-fallback

## Scope

This unit affects the Chrome extension side panel and voice hook behavior. The functional goal is not to redesign the conversation UI. The goal is to make primary remote MCP registration and browser fallback states explicit and safe.

## Component And Hook Responsibilities

### Voice Agent Hook

Existing responsibility:
- Initialize ElevenLabs SDK conversation behavior.
- Register browser `clientTools` callbacks.
- Coordinate tool responses with extension state.

U-V3-04 responsibility:
- Treat `clientTools` as fallback/UI support.
- Avoid comments, labels, or state names that imply browser callbacks are the remote MCP registration path.
- Return safe diagnostics when fallback is unavailable or authentication is missing.

Expected state:

| State | Meaning |
|---|---|
| `remote_mcp_primary` | Dashboard remote MCP registration is configured as the expected primary path. |
| `remote_mcp_unverified` | Primary setup exists but real verification is pending. |
| `client_tools_fallback` | Browser callbacks are active as fallback/UI support. |
| `hono_direct_fallback` | Extension is using direct Hono API fallback. |
| `unconfigured` | Required endpoint or auth configuration is missing. |

### Extension Fallback API Client

Existing responsibility:
- Send authenticated extension requests to SABOROU backend.
- Provide task, judgment, Slack reply, and related action helpers.

U-V3-04 responsibility:
- Be named and documented as a fallback/direct API client, not the primary AgentCore MCP client.
- Stop assuming `/mcp/tools/saborou_*` is a real AgentCore remote MCP endpoint.
- Preserve Cognito token handling and safe error mapping.

### Setup Status View Or Setup Guide Section

Expected responsibility:
- Surface non-secret setup state for demo operators.
- Show the primary Dashboard registration transport as `streamable_http`.
- Mention `sse` only as conditional fallback after compatibility failure.
- Explain that local `clientTools` are fallback/UI support.

Allowed display values:
- transport selection
- endpoint host or redacted endpoint URL
- fallback enabled state
- verification pending/pass/fail status
- safe diagnostic codes

Forbidden display values:
- JWT
- ElevenLabs API key
- Slack token
- Google token
- Authorization header
- raw signed AWS request

## User Interaction Flows

### Flow A: Normal Remote MCP Setup

1. Operator reads setup guidance.
2. Operator registers SABOROU remote MCP server in ElevenLabs Dashboard using `streamable_http`.
3. Extension side panel shows primary setup as expected or verification pending.
4. Voice invocation is validated in U-V3-05 real verification.

### Flow B: Local Fallback During Demo

1. Remote MCP path is missing, unverified, or temporarily unavailable.
2. Extension keeps local `clientTools` callbacks available.
3. User signs in with Cognito if needed.
4. Extension calls direct fallback API behavior.
5. UI labels the result as fallback mode.

### Flow C: Secret-Safe Failure

1. A fallback call fails due to missing auth, endpoint issue, or schema mismatch.
2. UI displays a safe message and diagnostic code.
3. UI does not display raw response bodies, tokens, headers, stack traces, or signed request data.

## API Integration Points

| Frontend Area | Backend/External Integration | U-V3-04 Rule |
|---|---|---|
| ElevenLabs Dashboard setup guide | Remote MCP endpoint from CDK/API outputs | Primary registration uses `streamable_http`. |
| Voice Agent Hook | ElevenLabs SDK `clientTools` | Fallback/UI only. |
| Extension fallback API client | SABOROU Hono API | Direct fallback with existing auth and approval rules. |
| Setup status view | local env/config and generated docs | Redacted, non-secret values only. |

## Validation Rules

- Transport label must be one of `streamable_http`, `sse`, or `unconfigured`.
- `sse` display must include that it is conditional fallback, not default.
- Fallback mode must be visually/textually distinct from primary remote MCP success.
- Errors shown in the UI must use safe diagnostic codes and short messages.
- The UI must not expose secrets even in debug or setup views.
