# MCP / AgentCore Gateway Connection Failure Requirements

**Date**: 2026-06-20T15:16:12Z  
**Request Type**: Bug fix / integration hardening  
**Scope**: Backend MCP transport, CDK outputs/docs, AgentCore Gateway target verification, integration scripts  
**Complexity**: Moderate to high, because the remaining failure crosses client transport selection, Gateway auth, AgentCore target invocation, and backend authorization.

## User Request

MCP server connection now fails with `Internal error: Unexpected ExceptionGroup` for:

- `https://saborou-mcp-gateway-dev-dcmjxh8d4z.gateway.bedrock-agentcore.ap-northeast-1.amazonaws.com/mcp` using `STREAMABLE_HTTP`
- the same AgentCore Gateway URL using `SSE`
- `https://71m86enw87.execute-api.ap-northeast-1.amazonaws.com/api/mcp` using `SSE`

The goal is to identify the root cause and prepare a fix plan so the MCP server also works through Bedrock AgentCore Gateway.

## User-Provided Verification Update

On 2026-06-20T15:25:19Z, the user confirmed that the MCP server can call tools successfully when using Streamable HTTP. This narrows the active failure scope:

- Direct MCP over Streamable HTTP is operational.
- SSE remains unsupported.
- Bedrock AgentCore Gateway connection and tool invocation remain the primary unresolved path.

## Current Evidence

### Static Code Findings

- `pkgs/backend/src/routes/mcp-jsonrpc.ts` implements MCP JSON-RPC over `POST /api/mcp`.
- `pkgs/backend/src/routes/mcp.ts` implements REST-style tool calls over `POST /api/mcp/tools/:toolName`.
- `pkgs/cdk/lib/stacks/api-stack.ts` creates:
  - `POST /api/mcp`
  - `POST /api/mcp/tools/{toolName}`
  - no `GET /api/mcp` or `text/event-stream` route for SSE.
- `pkgs/cdk/lib/stacks/agentcore-stack.ts` exposes OpenAPI target operations under `/api/mcp/tools/*` through AgentCore Gateway.
- `pkgs/extension/docs/ELEVENLABS_MCP_SETUP.md` tells operators to register `McpToolsBaseUrl` (`/api/mcp/tools`) as `streamable_http`, but that URL is a REST tool boundary, not a JSON-RPC MCP endpoint.

### Live Endpoint Probe

Unauthenticated probes were run only to check reachability and protocol shape, without secrets:

| Endpoint | Probe | Result |
|---|---|---|
| AgentCore Gateway `/mcp` | JSON-RPC `initialize` via POST | HTTP 401 with JSON-RPC error `Missing Bearer token` |
| API Gateway `/api/mcp` | JSON-RPC `initialize` via POST | HTTP 200 with MCP `protocolVersion: 2025-03-26` |
| API Gateway `/api/mcp` | GET with `Accept: text/event-stream` | HTTP 401 from the authenticated catch-all route |
| Direct MCP Streamable HTTP | User-tested tool calls | Tools can be called successfully |

## Root Cause Assessment

### RC-01: SSE transport is not implemented

`SSE` is currently not a valid transport for `https://71m86enw87.execute-api.ap-northeast-1.amazonaws.com/api/mcp`. The backend only handles `POST /api/mcp` for JSON-RPC. A `GET /api/mcp` request falls through API Gateway's authenticated proxy route and returns 401 before reaching an SSE handler.

**Impact**: Any client that auto-falls back to SSE will fail even if `streamable_http` is otherwise correct.

### RC-02: The direct Streamable HTTP path is functional, but endpoint documentation still needs cleanup

`McpToolsBaseUrl` points to `/api/mcp/tools`, which is only the REST adapter base used by the AgentCore OpenAPI target and internal tests. A direct MCP client expects JSON-RPC methods such as `initialize`, `tools/list`, and `tools/call`; those are served at `/api/mcp`.

**Impact**: The user's direct Streamable HTTP test proves the working endpoint exists. The remaining risk is operator confusion if docs or setup artifacts still point direct MCP clients at `/api/mcp/tools`.

### RC-03: AgentCore Gateway requires a valid bearer token before MCP initialization

The AgentCore Gateway is reachable and responds as a protected MCP resource, but unauthenticated `initialize` receives `Missing Bearer token`. This is expected for `CUSTOM_JWT`, but the current error report suggests the client may not be providing a valid Cognito bearer token, or the client is not completing OAuth-protected-resource discovery.

**Impact**: AgentCore Gateway connection fails before tool listing if the client has no valid token or uses the wrong auth mode. This is now the primary unresolved connection path.

### RC-04: AgentCore OpenAPI target invocation may not carry user identity into the REST adapter

The AgentCore Gateway target invokes `/api/mcp/tools/*` using `GATEWAY_IAM_ROLE`. The backend REST adapter still requires `Authorization: Bearer ...` and derives user identity in `resolveMcpIdentity()`. If AgentCore does not forward the caller's original bearer token to the target request, tool calls will fail at the backend authorization boundary even after Gateway connection succeeds.

**Impact**: Gateway can connect, but actual tools may fail with backend 401 unless identity bridging is implemented and verified.

## Functional Requirements

- FR-01: Preserve the now-verified canonical direct MCP endpoint for `streamable_http`: `POST /api/mcp`.
- FR-02: Do not advertise or register SSE unless a real SSE endpoint is implemented and tested.
- FR-03: Keep `/api/mcp/tools/{toolName}` as the AgentCore OpenAPI target boundary, not as a direct MCP server URL.
- FR-04: Verify AgentCore Gateway connection with a valid Cognito bearer token.
- FR-05: Verify AgentCore Gateway tool invocation reaches the backend with a resolvable SABOROU user identity.
- FR-06: If AgentCore does not forward user identity, add a safe identity bridge that preserves application-level authorization.
- FR-07: Update operator docs and CDK outputs so users do not confuse JSON-RPC MCP URL and REST tool target URL.
- FR-08: Add or update scripts/tests to catch transport URL mismatch and AgentCore auth/identity failures before demo use.

## Non-Functional Requirements

- NFR-01 Security: Keep Security Baseline enabled. Do not weaken backend object-level authorization to make Gateway calls pass.
- NFR-02 Security: Do not log bearer tokens, API keys, Slack tokens, Google tokens, or Travelpayouts credentials.
- NFR-03 Reliability: Verification must distinguish connection failure, auth failure, transport mismatch, and tool invocation failure.
- NFR-04 Maintainability: Preserve the separation between direct JSON-RPC MCP and AgentCore OpenAPI target REST adapter.
- NFR-05 Demo readiness: Produce exact registration values and verification commands for AgentCore Gateway and direct API Gateway fallback.

## Extension Compliance

| Extension | Status | Rationale |
|---|---|---|
| Security Baseline | Enabled / applicable | Existing state enables it; auth, logging, and least privilege are central to this fix. |
| Property-Based Testing | Disabled / N/A | Existing state disables it; this is transport/auth integration work, not pure transformation logic. |

## Approval Gate

Requirements are clear enough to proceed without additional question files. The next artifact is the fix execution plan.
