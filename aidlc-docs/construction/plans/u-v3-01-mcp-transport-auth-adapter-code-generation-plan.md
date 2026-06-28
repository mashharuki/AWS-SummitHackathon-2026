# Code Generation Plan - U-V3-01 mcp-transport-auth-adapter

**作成日**: 2026-06-17 JST
**Unit**: U-V3-01 mcp-transport-auth-adapter
**ステータス**: Generated - Review Required
**Single Source of Truth**: This document is the controlling plan for U-V3-01 Code Generation. Part 2 implementation must follow these steps in order and update checkboxes immediately after each completed step.

---

## Planning Completion Checklist

- [x] Step 1: Read U-V3-01 unit context, story map, NFR design, infrastructure design, backend entry point, middleware, and package dependencies.
- [x] Step 2: Confirm project type and code location from `aidlc-docs/aidlc-state.md`.
- [x] Step 3: Identify brownfield files to modify and new files to create.
- [x] Step 4: Define implementation steps, tests, verification commands, and story traceability.
- [x] Step 5: Record this plan as the single source of truth for Code Generation Part 2.

---

## Unit Context

U-V3-01 establishes the MCP adapter boundary that lets AgentCore/ElevenLabs invoke SABOROU tools without weakening the existing Cognito JWT protected browser and extension API.

Primary packages:

- `pkgs/backend`
- `pkgs/cdk`

Documentation package:

- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/code/`

No application code will be placed under `aidlc-docs/`.

---

## Story And Requirement Traceability

| Item | Coverage In This Unit |
|------|-----------------------|
| US-V3-01 | Enables identity-safe MCP task-list calls; concrete task tool schemas are expanded in U-V3-02. |
| US-V3-03 | Adds approval and side-effect precheck slot needed before Slack reply execution. |
| US-V3-06 | Maintains user authorization through AgentCore by rejecting IAM-only identity. |
| US-V3-08 | Provides secure backend transport boundary required before ElevenLabs Dashboard MCP registration. |
| FR-V3-06 | Implements AgentCore Gateway to Hono API authentication path. |
| GAP-V3-03 | Resolves AgentCore IAM target vs API Gateway JWT mismatch by requiring verified Cognito JWT in the adapter. |
| GAP-V3-04 | Adds MCP identity resolver instead of relying only on API Gateway requestContext claims. |
| GAP-V3-05 | Avoids treating pseudo `/mcp/tools/...` as full MCP; this unit only creates the secure adapter boundary. |
| NFR-V3-S1 | Cognito-backed identity, IAM-only rejection, fail-closed errors. |
| NFR-V3-S3 | No token or raw body logging. |
| NFR-V3-T1 | Unit tests, route tests, CDK assertions, Lean proof verification. |

---

## Dependencies And Constraints

- Existing direct routes must remain protected by the current API Gateway JWT authorizer.
- Existing public routes remain limited to health and OAuth callbacks.
- AgentCore IAM role is treated only as service-hop identity, not SABOROU user identity.
- If AgentCore does not forward a usable Cognito bearer token or verified equivalent context, the MCP adapter returns `UNAUTHORIZED`.
- U-V3-02 will expand the full MCP tool registry and schemas. U-V3-01 may include a minimal placeholder tool registry contract only where needed for precheck tests.
- Real AgentCore/ElevenLabs behavior remains verification-required and is handled in U-V3-05.

---

## Application Code Targets

### Backend: new files

- `pkgs/backend/src/mcp/types.ts`
- `pkgs/backend/src/mcp/identity.ts`
- `pkgs/backend/src/mcp/audit.ts`
- `pkgs/backend/src/mcp/precheck.ts`
- `pkgs/backend/src/routes/mcp.ts`

### Backend: modified files

- `pkgs/backend/package.json`
- `pkgs/backend/src/index.ts`

### Backend tests: new files

- `pkgs/backend/src/__tests__/mcp/identity.test.ts`
- `pkgs/backend/src/__tests__/mcp/audit.test.ts`
- `pkgs/backend/src/__tests__/mcp/precheck.test.ts`
- `pkgs/backend/src/__tests__/routes/mcp.test.ts`

### CDK: modified files

- `pkgs/cdk/lib/stacks/api-stack.ts`
- `pkgs/cdk/lib/stacks/agentcore-stack.ts`
- `pkgs/cdk/test/api-stack.test.ts`
- `pkgs/cdk/test/agentcore-stack.test.ts`

### Documentation: new files

- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/code/code-generation-summary.md`

---

## Dependency Plan

The backend currently has no JWT/JWKS verification dependency. Code Generation will add `jose` to `pkgs/backend` unless an existing workspace dependency is discovered immediately before implementation.

Reason:

- Cognito JWT verification needs issuer, audience, expiration, signature, and subject validation.
- Hand-rolling JWKS verification would increase security risk.
- `jose` can use remote JWKS and is appropriate for Node 22 Lambda.

Required environment variables for adapter verification:

- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `AWS_REGION`

If existing CDK env names differ, implementation must reuse the existing names and document the mapping in the summary.

---

## Code Generation Steps

- [x] Step 1: Add backend MCP domain types in `pkgs/backend/src/mcp/types.ts`.
  - Define `McpSource`, `McpIdentity`, `McpToolContext`, `McpToolInvocation`, `McpPrecheckResult`, `McpAuditStatus`, and safe response/error shapes.
  - Keep audit-safe types structurally unable to include raw token, raw args, prompt body, Slack/Gmail body, stack trace, or provider secret.

- [x] Step 2: Add Cognito-backed MCP identity resolver in `pkgs/backend/src/mcp/identity.ts`.
  - Extract bearer token from `Authorization`.
  - Verify issuer, audience, expiration, signature, and `sub`.
  - Reject IAM-only requests and missing/invalid tokens with `UnauthorizedError`.
  - Support dependency injection of a verifier function for unit tests.

- [x] Step 3: Add safe MCP audit logger in `pkgs/backend/src/mcp/audit.ts`.
  - Emit structured JSON with `action: "mcp_tool_call"`, `requestId`, `toolName`, `source`, `userIdHash`, `status`, and `durationMs`.
  - Hash userId with a deterministic non-secret SHA-256 digest prefix.
  - Exclude token, raw args, prompt text, message bodies, and stack traces.

- [x] Step 4: Add fail-closed MCP precheck in `pkgs/backend/src/mcp/precheck.ts`.
  - Check identity presence, allowed tool name, side-effect approval metadata, and request context.
  - Return stable failure codes for unauthorized, forbidden, validation error, and tool-not-allowed.
  - Include a minimal allowlist placeholder for U-V3-01 tests; full expansion remains U-V3-02.

- [x] Step 5: Add MCP adapter Hono route in `pkgs/backend/src/routes/mcp.ts`.
  - Implement `POST /tools/:toolName` under `/api/mcp`.
  - Resolve identity before dispatch.
  - Run precheck before any domain call.
  - Return safe JSON errors and safe audit events for success and failure.
  - Implement a minimal safe diagnostic result for allowed placeholder/read tool only if needed to prove the adapter path; do not publish full SABOROU tools before U-V3-02.

- [x] Step 6: Mount the MCP route in `pkgs/backend/src/index.ts`.
  - Add `app.route("/api/mcp", createMcpRoute(...))` before `app.onError`.
  - Preserve all existing routes and direct API behavior.

- [x] Step 7: Add backend unit and route tests.
  - Test valid Cognito identity resolution via injected verifier.
  - Test IAM-only, missing bearer token, invalid issuer/audience, and missing subject failures.
  - Test audit output excludes forbidden keys.
  - Test precheck blocks unknown tools, side-effect calls without approval, and missing identity.
  - Test `/api/mcp/tools/:toolName` returns safe errors and does not expose internal details.

- [x] Step 8: Add backend JWT dependency and update package metadata.
  - Add `jose` to `pkgs/backend/package.json`.
  - Update lockfile through the package manager during implementation if required.

- [x] Step 9: Update `pkgs/cdk/lib/stacks/api-stack.ts`.
  - Increase Hono Lambda log retention from 14 days to 90 days.
  - Add HTTP API access log group and access log settings without request bodies or authorization headers.
  - Add explicit MCP route infrastructure only if the current HTTP API route model requires it beyond existing `/{proxy+}` forwarding.
  - Add metric filters and CloudWatch alarms for MCP unauthorized, forbidden, and tool_error audit events.
  - Keep existing `/{proxy+}` JWT authorizer and existing public exceptions intact.

- [x] Step 10: Update `pkgs/cdk/lib/stacks/agentcore-stack.ts`.
  - Narrow `execute-api:Invoke` resource scope to the SABOROU API and MCP adapter target where practical.
  - Keep action-specific permissions.
  - Do not add DynamoDB, Secrets Manager, Slack, or Google data-plane permissions to the AgentCore Gateway role.
  - If route-level wildcard remains required, document the reason in code comments and tests.

- [x] Step 11: Update CDK tests.
  - Assert Lambda log retention is 90 days.
  - Assert access logging is configured.
  - Assert protected `/{proxy+}` route still uses JWT authorizer.
  - Assert public routes remain explicit.
  - Assert MCP-related logging/alarms exist.
  - Assert AgentCore role has no wildcard actions and does not gain data-plane permissions.

- [x] Step 12: Run focused verification commands.
  - `pnpm --filter backend test`
  - `pnpm --filter backend typecheck`
  - `pnpm --filter @full-stack-serverless/cdk test`
  - `pnpm --filter @full-stack-serverless/cdk build`
  - `lean aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/formal-verification/McpTransportAuthAdapter.lean`

- [x] Step 13: Create code generation summary.
  - Write `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/code/code-generation-summary.md`.
  - Include modified/created files, verification results, known U-V3-05 real-integration risk, and traceability to Lean proof concepts.

- [x] Step 14: Final duplicate and security check.
  - Confirm no duplicate `*_new`, `*_modified`, or alternate route files were created.
  - Confirm audit log code cannot emit raw tokens, raw args, prompt text, Slack/Gmail bodies, stack traces, or provider secrets.
  - Confirm existing direct API fallback is still present.

---

## Verification Gates

Code Generation Part 2 cannot be marked complete until:

- All plan steps above are checked.
- Backend and CDK tests/typechecks for affected packages pass, or failures are documented as environment-blocked with exact command output.
- Lean proof still passes without `sorry`, `axiom`, `admit`, or `unsafe`.
- Security Baseline applicable rules remain compliant.

---

## Known Residual Risk

AgentCore Gateway and ElevenLabs Dashboard forwarding behavior must be verified against real services in U-V3-05. This unit implements fail-closed application behavior: if a verified Cognito user identity cannot be obtained from the request, tool execution is denied.
