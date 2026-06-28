# Code Generation Summary - U-V3-01 mcp-transport-auth-adapter

**作成日**: 2026-06-17 JST
**Unit**: U-V3-01 mcp-transport-auth-adapter
**ステータス**: Generated

---

## Summary

U-V3-01 implemented a secure MCP adapter boundary for AgentCore/ElevenLabs-originated SABOROU calls while preserving the existing Cognito JWT protected direct API route.

The implementation intentionally does not publish the full SABOROU tool set yet. U-V3-02 owns concrete tool registry/schema expansion. This unit provides the verified transport, identity, precheck, and audit boundary.

---

## Created Application Files

- `pkgs/backend/src/mcp/types.ts`
- `pkgs/backend/src/mcp/identity.ts`
- `pkgs/backend/src/mcp/audit.ts`
- `pkgs/backend/src/mcp/precheck.ts`
- `pkgs/backend/src/routes/mcp.ts`
- `pkgs/backend/src/__tests__/mcp/identity.test.ts`
- `pkgs/backend/src/__tests__/mcp/audit.test.ts`
- `pkgs/backend/src/__tests__/mcp/precheck.test.ts`
- `pkgs/backend/src/__tests__/routes/mcp.test.ts`

## Modified Application Files

- `pkgs/backend/src/index.ts`
- `pkgs/backend/package.json`
- `pnpm-lock.yaml`
- `pkgs/cdk/lib/stacks/api-stack.ts`
- `pkgs/cdk/lib/stacks/agentcore-stack.ts`
- `pkgs/cdk/test/api-stack.test.ts`
- `pkgs/cdk/test/agentcore-stack.test.ts`

---

## Implemented Behavior

- `POST /api/mcp/tools/{toolName}` is added as the MCP adapter route.
- The MCP route resolves a verified Cognito identity from `Authorization: Bearer <jwt>`.
- Missing bearer token, IAM-only requests, invalid issuer/audience, and missing subject fail closed.
- Tool precheck verifies identity, allowlist membership, object-shaped args, and explicit side-effect approval.
- Safe MCP audit events include `requestId`, `toolName`, `source`, `userIdHash`, `status`, and `durationMs`.
- Audit events exclude JWTs, raw args, prompt text, Slack/Gmail bodies, stack traces, and provider secrets.
- API Gateway keeps existing `/{proxy+}` JWT authorizer.
- API Gateway adds explicit unauthenticated MCP route that relies on Lambda-side JWT verification.
- Lambda and API Gateway access logs use 90-day retention.
- CloudWatch metric filters and alarms cover MCP unauthorized, forbidden, and tool error statuses.
- AgentCore Gateway role is scoped to `POST /api/mcp/tools/*` on the SABOROU HTTP API.

---

## Lean Traceability

| Lean Concept | TypeScript Implementation |
|--------------|---------------------------|
| `resolveIdentity` | `resolveMcpIdentity` / `verifyCognitoJwt` |
| `precheck` | `precheckMcpInvocation` |
| `canAccessResource` | Identity-gated adapter context before future domain dispatch |
| `safeAudit` | `buildSafeMcpAuditEvent` / `auditMcpToolCall` |
| IAM-only rejection | `extractBearerToken` rejects non-bearer and missing authorization |
| Side-effect approval | `precheckMcpInvocation` rejects side-effect tools unless `approved === true` |

---

## Verification Results

| Command | Result |
|---------|--------|
| `pnpm --filter backend test` | Pass: 38 files, 412 tests |
| `pnpm --filter backend typecheck` | Pass |
| `pnpm --filter cdk test` | Pass: 9 suites, 84 tests |
| `pnpm --filter cdk build` | Pass |
| `lean aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/formal-verification/McpTransportAuthAdapter.lean` | Pass |

Note: The original plan listed the CDK workspace as `@full-stack-serverless/cdk`, but the actual package name in this repository is `cdk`; verification used the real workspace name.

---

## Security Baseline Compliance

| Rule | Status | Evidence |
|------|--------|----------|
| SECURITY-02 | Compliant | API Gateway access logs and MCP audit events added. |
| SECURITY-03 | Compliant | Structured audit event excludes sensitive fields. |
| SECURITY-05 | Compliant | MCP args are validated as object-shaped before dispatch. |
| SECURITY-06 | Compliant | AgentCore role scoped to execute-api adapter route. |
| SECURITY-08 | Compliant | Existing JWT route preserved; MCP route verifies Cognito JWT in Lambda. |
| SECURITY-09 | Compliant | Route returns stable safe errors only. |
| SECURITY-11 | Compliant | Adapter logic is isolated under `src/mcp` and `routes/mcp.ts`. |
| SECURITY-12 | Compliant | Cognito remains source of user identity. |
| SECURITY-14 | Compliant | 90-day retention, metric filters, and alarms added. |
| SECURITY-15 | Compliant | Missing/invalid identity and uncertain inputs fail closed. |

Blocking findings: None for U-V3-01 Code Generation.

---

## Residual Risk

Real AgentCore Gateway and ElevenLabs Dashboard forwarding behavior still requires U-V3-05 verification. If AgentCore/ElevenLabs does not forward a usable Cognito bearer token or verified equivalent context, this implementation denies execution with `UNAUTHORIZED` by design.
