# NFR Design Patterns - U-V3-02 mcp-tool-registry-schema

**作成日**: 2026-06-17 JST
**Unit**: U-V3-02 mcp-tool-registry-schema
**ステータス**: Review Required

---

## Pattern Summary

| Pattern ID | Pattern | Primary NFRs | Security Rules |
|------------|---------|--------------|----------------|
| NFRP-U3-02-01 | Registry As Policy Boundary | S1, M1 | SECURITY-08, SECURITY-11 |
| NFRP-U3-02-02 | Schema-First Tool Invocation | S2, S4 | SECURITY-05, SECURITY-13, SECURITY-15 |
| NFRP-U3-02-03 | Approval Metadata Gate | S4 | SECURITY-08, SECURITY-11, SECURITY-15 |
| NFRP-U3-02-04 | Safe Voice Output Envelope | S3 | SECURITY-03, SECURITY-09 |
| NFRP-U3-02-05 | Drift Detector Build Gate | R1, T1, M1 | SECURITY-10, SECURITY-13 |
| NFRP-U3-02-06 | Static Registry Warm-Path | P1 | SECURITY-11 |
| NFRP-U3-02-07 | Explicit Exclusion List | S1, A1 | SECURITY-08, SECURITY-11 |
| NFRP-U3-02-08 | Legacy OperationId Migration | R1, M1 | SECURITY-13 |
| NFRP-U3-02-09 | Reserved Tool Contract | A1, M1 | SECURITY-11, SECURITY-15 |

---

## NFRP-U3-02-01: Registry As Policy Boundary

**Intent**: Make MCP publication policy explicit and reviewable.

**Design**:

- Define a static TypeScript registry containing every published tool.
- Treat the registry as the only runtime allowlist.
- Every registry entry includes tool name, operationId, method, path, effect, approval flag, schemas, and description.
- Unknown tools are rejected before schema parsing or backend dispatch.

**Verification**:

- Registry test asserts the exact approved tool set.
- Runtime precheck test rejects a non-registry tool.
- OpenAPI drift test asserts all published operationIds exist in the registry.

---

## NFRP-U3-02-02: Schema-First Tool Invocation

**Intent**: Prevent untrusted MCP arguments from reaching domain logic unchecked.

**Design**:

- Each tool definition owns a Zod input schema.
- Adapter invokes `safeParse` before dispatch.
- Validation errors map to `VALIDATION_ERROR`.
- No domain handler receives raw `unknown` args.

**Verification**:

- Representative tool tests cover missing fields, wrong types, and overlong strings.
- Static scan or tests verify registry entries contain input and output schemas.

---

## NFRP-U3-02-03: Approval Metadata Gate

**Intent**: Ensure mutating and external-posting tools cannot execute without explicit user approval.

**Design**:

- Registry `effect` determines required approval.
- `write` and `external-post` imply `requiresHumanApproval = true`.
- Runtime precheck checks approval before backend dispatch.
- OpenAPI descriptions explicitly state approval requirements for side-effect tools.

**Verification**:

- Registry invariant test fails if effect and approval flag conflict.
- Runtime test rejects side-effect calls without approval.

---

## NFRP-U3-02-04: Safe Voice Output Envelope

**Intent**: Return outputs that are useful for voice agents without leaking provider payloads or secrets.

**Design**:

- Output schemas expose compact SABOROU result objects.
- Voice-friendly fields such as `summary`, `ttsSummary`, `tasks`, `candidates`, `counts`, and `ok` are preferred.
- Forbid token-like or raw-provider fields in output schema.

**Verification**:

- Schema test rejects forbidden output property names: `token`, `accessToken`, `refreshToken`, `authorization`, `rawBody`, `stack`.
- Google/Gmail/Slack schema tests assert summarized outputs only.

---

## NFRP-U3-02-05: Drift Detector Build Gate

**Intent**: Catch registry/OpenAPI/backend mismatch before deployment.

**Design**:

- Parse `pkgs/cdk/schemas/saborou-openapi.yaml` in tests.
- Compare path/method/operationId against registry definitions.
- Report missing, unexpected, operationId mismatch, unsafe route, and description/schema failures.
- Fail package tests on any drift.

**Verification**:

- CDK/schema test fails when a registry tool is removed from YAML.
- CDK/schema test fails when `/health`, `/api/auth/*`, or `/webhooks/*` appears.
- Failure output names the mismatched tool or route.

---

## NFRP-U3-02-06: Static Registry Warm-Path

**Intent**: Keep Lambda tool dispatch fast and deterministic.

**Design**:

- Registry is static module data.
- Runtime lookup uses an in-memory map derived at module load.
- No per-request YAML parsing, S3 reads, DynamoDB reads, or network calls for metadata.

**Verification**:

- Code review verifies no runtime dependency on YAML parser.
- Unit test can assert lookup returns in normal synchronous path.

---

## NFRP-U3-02-07: Explicit Exclusion List

**Intent**: Prevent accidental publication of unsafe or non-voice routes.

**Design**:

- Maintain a test-owned exclusion list for route patterns.
- Exclusions cover OAuth, webhooks, health, destructive delete/update, connection management, and UI-only helper routes.
- Drift detector checks the OpenAPI schema against this exclusion list.

**Verification**:

- Tests fail if excluded paths appear in AgentCore schema.

---

## NFRP-U3-02-08: Legacy OperationId Migration

**Intent**: Align AgentCore tool names with approved `saborou_*` voice-facing names.

**Design**:

- Replace legacy operationIds such as `listTasks`, `judgeSabori`, `sendSlackReply`, and `streamProposal`.
- If temporary aliases are needed, document them in a registry alias field and test them.
- Do not publish `streamProposal` unless a real backend route and tool contract exist.

**Verification**:

- Schema test asserts all operationIds start with `saborou_`.
- Schema test asserts `streamProposal` is absent unless explicitly allowlisted.

---

## NFRP-U3-02-09: Reserved Tool Contract

**Intent**: Let downstream units depend on `saborou_delegate_task_to_claude` without implementing behavior prematurely.

**Design**:

- Include a reserved registry/schema contract only if Code Generation needs downstream schema completeness.
- Mark implementation status as reserved or pending.
- Runtime dispatch must return a safe not-implemented response until U-V3-03 implements it, or the tool remains unpublished until U-V3-03.

**Verification**:

- Tests assert reserved tool cannot create Slack side effects in U-V3-02.

---

## Security Baseline Compliance

| Rule | NFR Design Status |
|------|-------------------|
| SECURITY-03 | Safe output and audit-compatible schema patterns prevent logging/output of sensitive payloads. |
| SECURITY-05 | Schema-first invocation pattern enforces input validation. |
| SECURITY-08 | Registry policy boundary and exclusion list preserve access control. |
| SECURITY-09 | Safe output envelope prevents internal/provider details in responses. |
| SECURITY-10 | Drift detector may add only official locked test dependencies. |
| SECURITY-11 | Publication policy is isolated in registry and misuse cases are covered. |
| SECURITY-13 | Drift detector verifies schema integrity before deployment. |
| SECURITY-14 | Tool failures remain auditable through U-V3-01 event envelope. |
| SECURITY-15 | Unknown tool, invalid args, missing approval, and drift fail closed. |

Blocking findings: None.
