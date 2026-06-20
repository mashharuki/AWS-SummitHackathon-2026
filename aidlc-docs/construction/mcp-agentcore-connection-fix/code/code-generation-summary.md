# Code Generation Summary - mcp-agentcore-connection-fix

**Date**: 2026-06-20T15:33:38Z  
**Unit**: `mcp-agentcore-connection-fix`

## Summary

This unit preserves the verified direct MCP Streamable HTTP path and tightens the remaining Bedrock AgentCore Gateway verification path. It does not add SSE support and does not add any identity bridge without live evidence of a verifiable AgentCore user identity source.

## Modified Files

- `pkgs/extension/docs/ELEVENLABS_MCP_SETUP.md`
  - Clarified `McpJsonRpcUrl`, `GatewayUrl`, and `McpToolsBaseUrl`.
  - Marked SSE as unsupported.
  - Prevented direct MCP clients from using `/api/mcp/tools`.
- `pkgs/cdk/test/api-stack.test.ts`
  - Added output semantics assertions for `McpJsonRpcUrl` and `McpToolsBaseUrl`.
- `scripts/verify-agentcore.sh`
  - Added optional redacted `COGNITO_TOKEN` support.
  - Added authenticated JSON-RPC `initialize` and `tools/list` checks.
  - Preserved unauthenticated reachability checks.
- `scripts/verify-mcp-auth.sh`
  - Added direct MCP JSON-RPC `initialize` and authenticated `tools/list` checks.
  - Added explicit SSE unsupported check.
  - Preserved REST adapter auth checks.
- `pkgs/backend/src/__tests__/routes/mcp-jsonrpc.test.ts`
  - Added initialize baseline coverage.
  - Added unsupported SSE GET coverage.
- `aidlc-docs/operations/v3-operations-deploy-demo.md`
  - Updated operations flow to use `McpJsonRpcUrl` for direct MCP and `GatewayUrl` for AgentCore Gateway.
  - Removed SSE fallback guidance.

## Intentional Non-Changes

- No SSE server support was added.
- No backend identity bridge was added.
- No IAM-authenticated AgentCore target request is treated as SABOROU user authorization.
- No side-effect approval behavior was weakened.

## Verification Results

Local verification completed:

| Command | Result |
|---|---|
| `bash -n scripts/verify-agentcore.sh` | PASS |
| `bash -n scripts/verify-mcp-auth.sh` | PASS |
| `git diff --check` | PASS |
| `pnpm --filter backend test` | PASS: 45 files, 466 tests |
| `pnpm --filter backend typecheck` | PASS |
| `pnpm --filter backend build` | PASS with existing esbuild duplicate-key warnings from bundled agent output |
| `pnpm --filter cdk test` | PASS: 10 suites, 93 tests |
| `pnpm --filter cdk build` | PASS |

Optional live verification when credentials are available:

```bash
AWS_REGION=ap-northeast-1 \
AGENTCORE_GATEWAY_ID=<gateway-id> \
COGNITO_TOKEN=<redacted> \
./scripts/verify-agentcore.sh

API_ENDPOINT=<api-origin> \
COGNITO_TOKEN=<redacted> \
./scripts/verify-mcp-auth.sh
```

## Security Baseline Compliance

| Rule | Status | Notes |
|---|---|---|
| SECURITY-02 | Compliant | API Gateway logging remains unchanged; scripts write sanitized evidence. |
| SECURITY-03 | Compliant | Scripts avoid logging bearer tokens. |
| SECURITY-05 | Compliant | Existing schema validation remains in place. |
| SECURITY-06 | Compliant | No IAM permissions changed. |
| SECURITY-08 | Compliant | No IAM role is converted into end-user authorization. |
| SECURITY-09 | Compliant | No verbose production error shape added. |
| SECURITY-12 | Compliant | JWT verification model remains server-side. |

## Remaining Live Checks

- Run AgentCore Gateway authenticated `initialize` and `tools/list` with a valid Cognito token.
- Confirm whether future AgentCore tool invocation forwards a usable user identity to `/api/mcp/tools/*`.
- If no user identity reaches the backend, keep user-scoped tools off the AgentCore OpenAPI path until a non-spoofable identity source is available.
