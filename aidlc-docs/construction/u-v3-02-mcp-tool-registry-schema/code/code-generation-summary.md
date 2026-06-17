# U-V3-02 Code Generation Summary: mcp-tool-registry-schema

## Summary
U-V3-02 implemented the MCP tool registry and schema publication boundary for SABOROU AgentCore integration. The U-V3-01 placeholder allowlist was replaced with a registry-backed, schema-first precheck path.

## Created Files
- `pkgs/backend/src/mcp/schemas.ts`
- `pkgs/backend/src/mcp/registry.ts`
- `pkgs/backend/src/__tests__/mcp/registry.test.ts`
- `pkgs/backend/src/__tests__/mcp/schemas.test.ts`
- `pkgs/cdk/test/agentcore-schema.test.ts`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/code/code-generation-summary.md`

## Modified Files
- `pkgs/backend/src/mcp/types.ts`
- `pkgs/backend/src/mcp/precheck.ts`
- `pkgs/backend/src/routes/mcp.ts`
- `pkgs/backend/src/__tests__/mcp/audit.test.ts`
- `pkgs/backend/src/__tests__/mcp/precheck.test.ts`
- `pkgs/backend/src/__tests__/routes/mcp.test.ts`
- `pkgs/cdk/schemas/saborou-openapi.yaml`
- `pkgs/cdk/package.json`
- `pnpm-lock.yaml`
- `aidlc-docs/construction/plans/u-v3-02-mcp-tool-registry-schema-code-generation-plan.md`
- `aidlc-docs/aidlc-state.md`
- `aidlc-docs/audit.md`

## Published Tool Registry
- `saborou_list_tasks`
- `saborou_get_task`
- `saborou_list_candidates`
- `saborou_generate_reply_draft`
- `saborou_judge_sabori`
- `saborou_fetch_google_calendar`
- `saborou_fetch_gmail`
- `saborou_send_slack_reply`
- `saborou_schedule_report`
- `saborou_delegate_to_claude` reserved for U-V3-03

## Validation Behavior
- Unknown tool names fail closed with `TOOL_NOT_ALLOWED`.
- Missing verified Cognito identity fails with `UNAUTHORIZED`.
- Non-object arguments and schema-invalid arguments fail with `VALIDATION_ERROR`.
- Tools marked approval-required fail with `FORBIDDEN` unless `approved: true` is present.
- Dispatch uses the validated registry definition and parsed args; the old placeholder dispatch and allowlist are removed from production code.

## AgentCore Schema Drift Gate
`pkgs/cdk/test/agentcore-schema.test.ts` parses `pkgs/cdk/schemas/saborou-openapi.yaml` with the direct `yaml` dev dependency and verifies:
- all published registry tools are present as OpenAPI operations,
- operation IDs, `x-saborou-mcp-tool`, and URL tool names stay aligned,
- all published paths use the `/api/mcp/tools/saborou_*` adapter boundary,
- excluded auth, webhook, docs, health, openapi, and internal routes are not published,
- approval-required registry tools are marked with `x-saborou-approval-required: true`.

## Verification Results
- `pnpm --filter backend test`: passed, 40 files / 425 tests.
- `pnpm --filter backend typecheck`: passed.
- `pnpm --filter cdk test`: passed, 10 suites / 89 tests.
- `pnpm --filter cdk build`: passed.
- Targeted security checks:
  - no production references remain for `saborou_mcp_health`, `saborou_side_effect_probe`, `DEFAULT_MCP_TOOL_ALLOWLIST`, or `dispatchPlaceholderTool`,
  - OpenAPI schema contains no direct excluded route publication,
  - all side-effect registry entries require explicit approval.

## Extension Compliance
| Extension Rule | Status | Rationale |
|---|---|---|
| Security Baseline | Compliant | Registry allowlist, Zod input validation, approval enforcement, safe audit envelope, excluded route checks, and drift tests are implemented. |
| Property-Based Testing | N/A | Disabled in `aidlc-docs/aidlc-state.md`. |

## Residual Risks
- The registry currently validates and publishes tool contracts; real domain dispatch remains intentionally deferred to later v3 units.
- `saborou_delegate_to_claude` is published as a reserved, approval-required contract and returns a safe reserved response until U-V3-03.
- Real AgentCore Gateway and ElevenLabs Dashboard behavior still requires U-V3-05 integration verification.
