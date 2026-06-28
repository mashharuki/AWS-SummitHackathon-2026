# U-V3-02 Code Generation Plan: mcp-tool-registry-schema

## Stage Context
- **Phase**: CONSTRUCTION
- **Unit**: U-V3-02 mcp-tool-registry-schema
- **Stage**: Code Generation
- **Part**: Part 1 - Planning
- **Created At**: 2026-06-17T03:48:52Z
- **Status**: Planning complete; awaiting explicit user approval before code generation.

## Scope
Generate the backend MCP tool registry, schema catalog, precheck integration, AgentCore OpenAPI schema artifact, drift validation tests, and code generation summary for U-V3-02.

This unit replaces the U-V3-01 placeholder allowlist with an allowlist-only registry and schema-first validation boundary. It must keep the published AgentCore invocation path aligned with the U-V3-01 MCP adapter route:

```text
POST /api/mcp/tools/{toolName}
```

## Non-Scope
- Do not introduce new AWS runtime resources.
- Do not weaken existing JWT-authenticated Hono API routes.
- Do not publish auth, webhook, Swagger UI, debug, or internal routes as MCP tools.
- Do not place application code under `aidlc-docs/`.
- Do not implement U-V3-03 Slack delegation fallback beyond reserving the registry contract for the delegation tool.

## Inputs Reviewed
- [x] U-V3-02 Functional Design artifacts.
- [x] U-V3-02 NFR Requirements artifacts.
- [x] U-V3-02 NFR Design artifacts.
- [x] U-V3-02 Infrastructure Design artifacts.
- [x] Existing U-V3-01 MCP adapter implementation under `pkgs/backend/src/mcp/` and `pkgs/backend/src/routes/mcp.ts`.
- [x] Existing AgentCore OpenAPI artifact at `pkgs/cdk/schemas/saborou-openapi.yaml`.
- [x] Existing package manifests for `backend` and `cdk`.

## Application Code Targets

### Backend
- `pkgs/backend/src/mcp/types.ts`
  - Expand MCP tool metadata types.
  - Add typed tool names, HTTP method/path metadata, schema references, approval metadata, output mode, and implementation status.
  - Keep safe response and audit types compatible with U-V3-01.

- `pkgs/backend/src/mcp/schemas.ts`
  - Add Zod input and output schemas for published tools.
  - Keep schema fields minimal for voice-agent-safe responses.
  - Export schema catalog helpers needed by registry and tests.

- `pkgs/backend/src/mcp/registry.ts`
  - Add `MCP_TOOL_REGISTRY` as the single allowlist source of truth.
  - Export `MCP_TOOL_NAMES`, `MCP_TOOL_MAP`, `getMcpToolDefinition`, `getPublishedMcpTools`, and `isMcpToolName`.
  - Add explicit excluded route patterns for auth, webhook, docs, health/debug, and internal routes.
  - Preserve the reserved tool contract for U-V3-03 delegation.

- `pkgs/backend/src/mcp/precheck.ts`
  - Replace `DEFAULT_MCP_TOOL_ALLOWLIST` placeholder data with registry-backed validation.
  - Validate `args` with each tool's Zod input schema.
  - Enforce explicit approval for write/external-post tools.
  - Return parsed arguments on successful precheck so dispatch cannot use unvalidated input.

- `pkgs/backend/src/routes/mcp.ts`
  - Replace `dispatchPlaceholderTool` with registry-aware dispatch behavior.
  - Return safe not-implemented responses only for explicitly reserved future tools.
  - Preserve safe error mapping, safe audit envelope, and fail-closed behavior.
  - Keep `POST /api/mcp/tools/:toolName` as the only MCP invocation endpoint.

### Backend Tests
- `pkgs/backend/src/__tests__/mcp/registry.test.ts`
  - Verify allowlist membership, unique tool names, excluded routes, approval metadata, and publication flags.

- `pkgs/backend/src/__tests__/mcp/schemas.test.ts`
  - Verify accepted and rejected inputs for representative read, write, and external-post tools.

- `pkgs/backend/src/__tests__/mcp/precheck.test.ts`
  - Update tests for registry-backed lookup, schema validation, parsed args, and side-effect approval enforcement.

- `pkgs/backend/src/__tests__/routes/mcp.test.ts`
  - Update tests from placeholder tools to real registry tools.
  - Verify unknown tools, invalid args, missing approval, success envelopes, and audit status mapping.

### CDK / AgentCore Schema
- `pkgs/cdk/schemas/saborou-openapi.yaml`
  - Update published operations to target `/api/mcp/tools/{toolName}`.
  - Use `saborou_*` operation IDs that match backend registry names.
  - Keep request bodies aligned to MCP adapter body shape: `{ args, approved }`.
  - Keep descriptions concise and safe for voice-agent use.

- `pkgs/cdk/test/agentcore-schema.test.ts`
  - Parse the OpenAPI artifact and verify:
    - all published operation IDs exist in backend registry,
    - all registry-published tools exist in OpenAPI,
    - all paths use `/api/mcp/tools/{toolName}`,
    - excluded routes are not published,
    - external-post/write tools require approval metadata in schema descriptions or extensions.

- `pkgs/cdk/package.json` and `pnpm-lock.yaml`
  - Add a direct CDK dev dependency for YAML parsing if needed by the new drift test.

### Documentation
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/code/code-generation-summary.md`
  - Summarize generated files, registry contents, validation behavior, drift gates, verification results, and residual risks.

## Planned Published Tool Set
- `saborou_list_tasks`: read-only task context retrieval.
- `saborou_get_task`: read-only task detail retrieval.
- `saborou_list_candidates`: read-only Slack candidate retrieval.
- `saborou_generate_reply_draft`: read-only draft generation.
- `saborou_judge_sabori`: read-only immediate Slack message judgment and reply draft generation.
- `saborou_fetch_google_calendar`: write/external import of Google Calendar context into SABOROU.
- `saborou_fetch_gmail`: write/external import of Gmail context into SABOROU.
- `saborou_send_slack_reply`: external-post Slack send; explicit approval required.
- `saborou_schedule_report`: write/draft generation for task progress report; explicit approval required if it sends or schedules side effects.
- `saborou_delegate_to_claude`: reserved delegation contract for U-V3-03; published only if safely marked as reserved/non-executable until implemented.

The implementation phase may reduce this set only if the existing code cannot safely support a tool without crossing Unit boundaries; any reduction must be documented in the summary and tests.

## Execution Checklist

### Part 1 - Planning
- [x] Confirm U-V3-02 Infrastructure Design approval from the latest user request.
- [x] Inspect current U-V3-01 MCP adapter code and placeholder allowlist.
- [x] Inspect current AgentCore OpenAPI artifact and package manifests.
- [x] Define exact backend, CDK, test, and documentation targets.
- [x] Create this Code Generation plan.
- [x] Update `aidlc-docs/audit.md` and `aidlc-docs/aidlc-state.md`.
- [x] Receive explicit user approval to start Part 2.

### Part 2 - Generation
- [x] Create/modify backend MCP types, schema catalog, and registry.
- [x] Update MCP precheck to use registry-backed schema validation and approval metadata.
- [x] Update MCP route to use registry-aware dispatch behavior and remove placeholder allowlist responses.
- [x] Add backend registry/schema/precheck/route tests.
- [x] Update `saborou-openapi.yaml` to publish registry tools through `/api/mcp/tools/{toolName}`.
- [x] Add CDK schema drift test and direct YAML parser dependency if required.
- [x] Run backend verification: `pnpm --filter backend test`.
- [x] Run backend type verification: `pnpm --filter backend typecheck`.
- [x] Run CDK verification: `pnpm --filter cdk test`.
- [x] Run CDK build: `pnpm --filter cdk build`.
- [x] Run targeted security checks for excluded routes, side-effect approval, and safe output behavior.
- [x] Generate U-V3-02 code generation summary.
- [x] Update this plan's checkboxes immediately as each step completes.
- [x] Update `aidlc-docs/aidlc-state.md` and `aidlc-docs/audit.md`.

## Verification Commands
```bash
pnpm --filter backend test
pnpm --filter backend typecheck
pnpm --filter cdk test
pnpm --filter cdk build
```

## Risk Controls
- Registry is the single publication policy boundary.
- Schema validation happens before dispatch.
- External-post/write tools require explicit approval.
- Unknown tools fail closed.
- OpenAPI drift test prevents schema/registry divergence.
- Existing JWT API routes remain mounted and unchanged except for any explicit dependency injection needed by MCP dispatch.

## Extension Compliance
| Extension Rule | Status | Rationale |
|---|---|---|
| Security Baseline | Compliant | Plan preserves auth boundary, allowlist-only publication, schema validation, least privilege, safe auditing, and side-effect approval requirements. |
| Property-Based Testing | N/A | Extension is disabled in `aidlc-docs/aidlc-state.md`. |

## Approval Gate
Code Generation Part 1 is complete. Part 2 will modify application code, tests, package metadata if needed, and documentation only after explicit user approval.
