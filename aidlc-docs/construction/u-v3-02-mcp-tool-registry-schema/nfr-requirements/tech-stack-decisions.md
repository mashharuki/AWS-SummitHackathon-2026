# Tech Stack Decisions - U-V3-02 mcp-tool-registry-schema

**作成日**: 2026-06-17 JST
**Unit**: U-V3-02 mcp-tool-registry-schema
**ステータス**: Review Required

---

## Decision Summary

U-V3-02 should use the existing TypeScript/Hono/Zod/CDK stack and add the smallest necessary schema tooling to make MCP publication deterministic and testable.

---

## Decision 1: Registry Representation

**Decision**: Define MCP registry as TypeScript static data.

Preferred location:

- `pkgs/backend/src/mcp/registry.ts`

Alternative if shared cross-package access becomes necessary:

- `pkgs/shared/src/mcp/registry.ts`

Rationale:

- Runtime dispatch in U-V3-01 already lives in backend MCP code.
- Static TypeScript data gives type safety and fast Lambda warm-path lookup.
- CDK tests can import or compare against a serialized registry if needed.

Constraints:

- Registry must not require network or database access.
- Registry must not parse YAML at runtime.

---

## Decision 2: Input Schema Technology

**Decision**: Use Zod schemas for runtime input validation.

Rationale:

- Existing backend routes already use Zod and `@hono/zod-validator`.
- Zod supports required fields, max lengths, enums, and safe parsing.
- Tool schemas can mirror existing shared schemas where they already exist.

Constraints:

- Do not pass `unknown` args into domain logic before Zod parse.
- Avoid duplicating route schemas where existing shared schemas are reliable.

---

## Decision 3: OpenAPI Schema Handling

**Decision**: Maintain `pkgs/cdk/schemas/saborou-openapi.yaml` as the AgentCore deployment artifact, but require deterministic validation against the registry.

Rationale:

- AgentCore stack already deploys this YAML from S3.
- Full generator implementation may be larger than necessary for this unit.
- Drift tests close the current safety gap without changing deployment flow.

Future-compatible option:

- Generate YAML from registry once registry/schema representation stabilizes.

---

## Decision 4: YAML Parsing For Tests

**Decision**: Use an official YAML parser only in test/tooling code if the repository does not already include one.

Candidate:

- `yaml`

Rationale:

- Tests need structured parsing of OpenAPI YAML.
- Ad hoc string parsing would be fragile and miss schema drift.

Constraints:

- Dependency must be locked in `pnpm-lock.yaml`.
- Parser should not be bundled into Lambda runtime unless runtime generation is intentionally added.

---

## Decision 5: Test Placement

**Decision**: Put runtime registry/precheck tests in backend and schema deployment assertions in CDK.

Recommended files:

- `pkgs/backend/src/__tests__/mcp/registry.test.ts`
- `pkgs/backend/src/__tests__/mcp/precheck.test.ts`
- `pkgs/cdk/test/agentcore-schema.test.ts`

Rationale:

- Backend owns runtime validation.
- CDK owns the deployed AgentCore schema artifact.

---

## Decision 6: OperationId Naming

**Decision**: Use `saborou_*` operationIds in AgentCore OpenAPI.

Rationale:

- Requirements and application design define these as voice-facing tool names.
- Existing operationIds such as `listTasks`, `judgeSabori`, and `streamProposal` are implementation-oriented and inconsistent with the approved tool contract.

Constraints:

- Any temporary alias must be documented and covered by tests.
- Final public schema should not expose `streamProposal` unless a real matching backend route exists and it is intentionally included.

---

## Decision 7: Build And CI Integration

**Decision**: Keep verification in existing package test commands for U-V3-02.

Required commands after Code Generation:

- `pnpm --filter backend test`
- `pnpm --filter backend typecheck`
- `pnpm --filter cdk test`
- `pnpm --filter cdk build`

Rationale:

- These are already used successfully in U-V3-01.
- No new top-level workflow is necessary for this unit.

---

## Rejected Options

| Option | Rejection Reason |
|--------|------------------|
| Publish all Hono routes automatically | Violates allowlist and unsafe route exclusion requirements. |
| Use YAML as runtime source of truth | Adds runtime parsing overhead and weak type safety. |
| Ad hoc string parsing for OpenAPI tests | Fragile and insufficient for drift detection. |
| Implement `@Claude` delegation behavior in this unit | U-V3-03 owns behavior; U-V3-02 only reserves schema contract. |
| Property-based testing | v3 Extension Configuration disables it; deterministic schema/registry tests are enough for this scope. |

---

## Security Baseline Impact

| Rule | Tech Stack Impact |
|------|-------------------|
| SECURITY-05 | Zod required for tool args. |
| SECURITY-08 | Registry must carry user-scoped route mapping and exclude unsafe routes. |
| SECURITY-10 | Any YAML parser dependency must be official and lockfile-pinned. |
| SECURITY-11 | Registry isolates security-critical publication policy. |
| SECURITY-13 | YAML parse/drift tests verify schema integrity. |
| SECURITY-15 | Runtime registry lookup and schema parse fail closed. |
