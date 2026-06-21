# Code Generation Plan - mcp-agentcore-connection-fix

**Unit**: `mcp-agentcore-connection-fix`  
**Plan Status**: Completed
**Created**: 2026-06-20T15:31:31Z  
**Source Plan**: `aidlc-docs/inception/plans/mcp-agentcore-connection-fix-plan.md`

## Unit Context

Direct MCP Streamable HTTP has been verified by the user to call tools successfully. This unit preserves that working path and focuses on making Bedrock AgentCore Gateway usable by removing endpoint confusion, strengthening verification scripts, and only adding backend identity bridging if live evidence proves it is required.

## Dependencies and Boundaries

- Existing direct JSON-RPC MCP route: `POST /api/mcp`
- Existing REST MCP adapter route: `POST /api/mcp/tools/{toolName}`
- Existing AgentCore Gateway OpenAPI target: `/api/mcp/tools/*`
- Existing backend identity resolver: `pkgs/backend/src/mcp/identity.ts`
- Existing CDK stacks:
  - `pkgs/cdk/lib/stacks/api-stack.ts`
  - `pkgs/cdk/lib/stacks/agentcore-stack.ts`
- Security Baseline remains enabled. IAM role alone must not become SABOROU user authorization.

## Target Files

Application code and scripts:

- `scripts/verify-agentcore.sh`
- `scripts/verify-mcp-auth.sh`
- `pkgs/backend/src/routes/mcp-jsonrpc.ts` only if an explicit unsupported SSE response is needed
- `pkgs/backend/src/__tests__/routes/mcp-jsonrpc.test.ts`
- `pkgs/cdk/test/api-stack.test.ts`

Documentation:

- `pkgs/extension/docs/ELEVENLABS_MCP_SETUP.md`
- `aidlc-docs/operations/v3-operations-deploy-demo.md`
- `aidlc-docs/construction/u-v3-04-elevenlabs-registration-fallback/code/code-generation-summary.md` if historical note needs correction
- `aidlc-docs/construction/mcp-agentcore-connection-fix/code/code-generation-summary.md`

## Story / Requirement Traceability

| Requirement | Covered By |
|---|---|
| FR-01 Preserve direct Streamable HTTP `/api/mcp` | Steps 1, 2, 4 |
| FR-02 Do not advertise SSE while unsupported | Steps 1, 2, 4 |
| FR-03 Keep `/api/mcp/tools/{toolName}` as AgentCore target boundary | Steps 1, 3, 4 |
| FR-04 Verify AgentCore Gateway with Cognito bearer token | Step 3 |
| FR-05 Verify AgentCore target reaches backend with user identity | Step 3 |
| FR-06 Add identity bridge only if required | Step 5 decision gate |
| FR-07 Update operator docs and CDK output meaning | Steps 1, 4 |
| FR-08 Add tests/scripts for mismatch detection | Steps 2, 3, 4 |

## Execution Steps

### Step 1: Documentation - Endpoint Model Cleanup

- [x] Update `pkgs/extension/docs/ELEVENLABS_MCP_SETUP.md`.
- [x] Clarify three distinct URLs:
  - `McpJsonRpcUrl` (`/api/mcp`) for direct MCP Streamable HTTP.
  - `GatewayUrl` (`...gateway.../mcp`) for Bedrock AgentCore Gateway MCP.
  - `McpToolsBaseUrl` (`/api/mcp/tools`) for AgentCore OpenAPI target / REST adapter boundary only.
- [x] Mark SSE as unsupported unless a future SSE bridge is implemented.
- [x] Correct tool names and examples where they still imply `/api/mcp/tools` is a direct MCP server.

### Step 2: CDK Tests - Output Semantics

- [x] Update `pkgs/cdk/test/api-stack.test.ts`.
- [x] Rename or rewrite the existing `McpToolsBaseUrl` test comment so it no longer says it is the ElevenLabs Streamable HTTP registration URL.
- [x] Add an assertion for `McpJsonRpcUrl` output containing `/api/mcp`.
- [x] Assert `McpJsonRpcUrl` and `McpToolsBaseUrl` are distinct outputs with distinct suffixes.

### Step 3: Verification Script - AgentCore Gateway

- [x] Update `scripts/verify-agentcore.sh` to accept optional `COGNITO_TOKEN`.
- [x] Preserve unauthenticated reachability check: 401/403 from Gateway still means the endpoint exists.
- [x] When `COGNITO_TOKEN` is set, send JSON-RPC `initialize` and `tools/list` to `GatewayUrl`.
- [x] Do not print or write the raw token to evidence logs.
- [x] Capture sanitized status, response code, and high-level response shape.
- [x] Add clear result classes:
  - reachability pass but auth missing,
  - auth pass and tool list pass,
  - Gateway auth failure,
  - target/tool invocation failure.

### Step 4: Verification Script - Direct MCP and SSE Unsupported Path

- [x] Update `scripts/verify-mcp-auth.sh` or add a focused direct MCP section.
- [x] Verify `POST /api/mcp` `initialize`.
- [x] Verify authenticated `tools/list` against `/api/mcp`.
- [x] Verify `GET /api/mcp` with `Accept: text/event-stream` is reported as unsupported, not as a generic MCP failure.
- [x] Keep existing REST adapter auth rejection checks for `/api/mcp/tools/saborou_list_tasks`.

### Step 5: Backend Identity Bridge Decision Gate

- [x] Do not implement an identity bridge by default.
- [x] If live AgentCore verification shows original bearer token is forwarded to `/api/mcp/tools/*`, add only regression tests/documentation.
- [x] If live AgentCore verification shows no user identity reaches the backend, stop before implementing user-scoped tool enablement and document the blocked condition.
- [x] Only implement a bridge if there is a verifiable, non-spoofable AgentCore-provided identity source.

### Step 6: Backend Tests

- [x] Update `pkgs/backend/src/__tests__/routes/mcp-jsonrpc.test.ts`.
- [x] Add or confirm direct Streamable HTTP baseline coverage:
  - `initialize` returns MCP server info.
  - authenticated `tools/list` returns published tools.
  - authenticated `tools/call` invokes internal API with `x-internal-sub`.
- [x] Add a test for unsupported SSE behavior only if a specific `GET /api/mcp` handler is introduced.

### Step 7: Operations Documentation

- [x] Update `aidlc-docs/operations/v3-operations-deploy-demo.md` and related operation docs that still describe `McpToolsBaseUrl` as a direct Streamable HTTP MCP endpoint.
- [x] Add an AgentCore Gateway verification sequence:
  - get `GatewayUrl`,
  - get `GatewayIdentifier`,
  - run `scripts/verify-agentcore.sh`,
  - inspect sanitized evidence.
- [x] Add direct fallback instructions using `McpJsonRpcUrl`.

### Step 8: Code Generation Summary

- [x] Create `aidlc-docs/construction/mcp-agentcore-connection-fix/code/code-generation-summary.md`.
- [x] Summarize modified files, verification commands, and remaining live AWS checks.
- [x] Include Security Baseline compliance summary.

### Step 9: Verification Commands

- [x] Run `pnpm --filter backend test`.
- [x] Run `pnpm --filter backend typecheck`.
- [x] Run `pnpm --filter backend build`.
- [x] Run `pnpm --filter cdk test`.
- [x] Run `pnpm --filter cdk build`.
- [x] If credentials are available, run `AWS_REGION=ap-northeast-1 AGENTCORE_GATEWAY_ID=... COGNITO_TOKEN=... ./scripts/verify-agentcore.sh`. Not run in this session because live Cognito credentials were not available; documented as remaining live check.
- [x] If credentials are available, run `API_ENDPOINT=... COGNITO_TOKEN=... ./scripts/verify-mcp-auth.sh`. Not run in this session because live Cognito credentials were not available; documented as remaining live check.

## Non-Implementation Guardrails

- Do not add SSE server support unless explicitly requested after this unit.
- Do not convert IAM-authenticated AgentCore target requests into user identity.
- Do not log bearer tokens or secrets in script output.
- Do not remove existing REST adapter route because AgentCore OpenAPI target depends on it.
- Do not weaken side-effect approval checks.

## Completion

Code Generation Part 2 completed. All planned local steps are marked complete. Live AgentCore Gateway verification with a real Cognito token remains a manual follow-up because credentials were not available in this session.
