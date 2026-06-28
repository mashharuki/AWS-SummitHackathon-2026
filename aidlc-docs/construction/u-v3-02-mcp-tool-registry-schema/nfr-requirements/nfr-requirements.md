# NFR Requirements - U-V3-02 mcp-tool-registry-schema

**作成日**: 2026-06-17 JST
**Unit**: U-V3-02 mcp-tool-registry-schema
**ステータス**: Review Required

---

## NFR Summary

U-V3-02 is security- and correctness-critical because it defines which SABOROU capabilities become voice-callable MCP tools. The primary NFR objective is to prevent unsafe route publication and schema drift while keeping tool calls predictable for AgentCore and ElevenLabs.

---

## NFR-U3-02-S1: Allowlist Security

**Category**: Security

Only registry-defined tools may be published or invoked.

Requirements:

- Runtime dispatch must reject unknown tools.
- OpenAPI schema must not include routes absent from the registry allowlist.
- OAuth, webhook, health, connection management, delete, and UI-helper routes must remain excluded.
- Tests must fail if excluded routes appear in `pkgs/cdk/schemas/saborou-openapi.yaml`.

Acceptance criteria:

- Unknown tool returns `TOOL_NOT_ALLOWED`.
- Schema allowlist test passes only when all published operationIds are registry-approved.
- Excluded route test explicitly checks `/health`, `/api/auth/*`, `/webhooks/*`, and destructive task endpoints.

---

## NFR-U3-02-S2: Input Validation

**Category**: Security / Data Integrity

Every MCP tool input must be schema-validated before backend dispatch.

Requirements:

- Required fields must be explicit.
- String fields must have maximum lengths.
- ID/path parameters must be non-empty and format-constrained where practical.
- Enum-like values must use enums.
- Side-effect tools must accept explicit approval metadata.
- Raw HTML/script-like input must be rejected or bounded to non-rendered text usage.

Acceptance criteria:

- Tests cover invalid shape, missing required fields, and overlong strings for representative tools.
- No tool accepts `unknown` args directly into domain logic without schema parse.

---

## NFR-U3-02-S3: Output Data Minimization

**Category**: Security / Privacy

Tool outputs must be stable, summarized, and voice-friendly.

Requirements:

- No JWT, OAuth token, Slack Bot token, Google access token, or provider secret may appear in output schema.
- Gmail body and Slack raw message body must not be exposed.
- Provider responses must be normalized into compact SABOROU result objects.
- Outputs should include `summary` or equivalent voice-readable fields where helpful.

Acceptance criteria:

- Schema tests reject forbidden output property names such as `token`, `accessToken`, `refreshToken`, `rawBody`, `body`, `authorization`, and `stack`.
- Google/Slack tools return counts, candidate summaries, channel identifiers, timestamps, or task references only.

---

## NFR-U3-02-S4: Side-Effect Approval Enforcement

**Category**: Security / Safety

Any mutating or external-posting tool must require explicit approval.

Requirements:

- Registry must contain `effect` and `requiresHumanApproval`.
- `write` and `external-post` tools must have `requiresHumanApproval = true`.
- Runtime precheck must enforce this registry metadata.
- OpenAPI descriptions must warn that approval is required.

Acceptance criteria:

- Tests fail if side-effect tools are not approval-required.
- Runtime tests fail if side-effect tools execute without approval metadata.

---

## NFR-U3-02-R1: Schema Drift Prevention

**Category**: Reliability / Maintainability

Registry, AgentCore OpenAPI schema, and backend route mappings must not diverge silently.

Requirements:

- There must be one authoritative registry or a deterministic drift detector.
- Drift test must compare registry tool names, operationIds, methods, and paths with `saborou-openapi.yaml`.
- Existing legacy operationIds such as `listTasks`, `judgeSabori`, and `streamProposal` must be replaced or explicitly mapped.
- Any missing or unexpected operation is a test failure.

Acceptance criteria:

- `pnpm --filter backend test` or CDK/schema tests include registry drift validation.
- The test output identifies missing and unexpected tools clearly.

---

## NFR-U3-02-P1: Tool Metadata Performance

**Category**: Performance

Registry lookup and schema validation overhead must be small relative to voice-call latency.

Requirements:

- Tool lookup target: under 5 ms in Lambda warm path for in-memory registry.
- Schema validation target: under 20 ms for normal tool args.
- Registry definitions should be static module data, not fetched from S3/DynamoDB during every invocation.

Acceptance criteria:

- Code Generation must avoid per-request YAML parsing.
- Runtime should import compiled registry data.

---

## NFR-U3-02-A1: Demo Availability

**Category**: Availability

Schema publication must not make the existing direct Hono fallback unusable.

Requirements:

- Existing browser/extension API routes remain available.
- AgentCore schema changes must be isolated to MCP publication.
- If one tool is invalid, tests fail before deployment rather than partially publishing unsafe schema.

Acceptance criteria:

- Existing backend route tests continue passing.
- CDK schema deployment path remains deterministic.

---

## NFR-U3-02-T1: Test Coverage

**Category**: Testability

Code Generation must add focused tests for schema and registry correctness.

Required tests:

- Registry contains all approved U-V3-02 tools.
- Registry excludes unsafe routes.
- Each tool has operationId, method, path, description, effect, approval flag, input schema, and output schema.
- Side-effect classification is internally consistent.
- OpenAPI schema includes expected operationIds and excludes unsafe ones.
- Schema descriptions are non-empty and AI-oriented.
- `saborou_judge_sabori` description does not overclaim a meaningful score if fixed score remains.

---

## NFR-U3-02-M1: Maintainability

**Category**: Maintainability

Adding future MCP tools must be low-risk and reviewable.

Requirements:

- A new tool should require adding exactly one registry entry and one schema mapping/generation result.
- Documentation should identify whether the tool is read/write/external-post.
- Failure messages from drift tests should point to the missing registry or schema item.

Acceptance criteria:

- Code organization keeps registry definitions near MCP adapter code or shared package code.
- Tests explain how to add or intentionally exclude a route.

---

## Security Baseline Compliance

| Rule | Status | Rationale |
|------|--------|-----------|
| SECURITY-01 | N/A | U-V3-02 defines registry/schema behavior; no new persistence store is introduced at NFR Requirements stage. |
| SECURITY-02 | N/A | Network intermediary logging was addressed in U-V3-01; U-V3-02 does not add a new intermediary. |
| SECURITY-03 | Compliant | Safe structured audit logging remains required from U-V3-01; U-V3-02 forbids logging raw provider payloads through schemas. |
| SECURITY-04 | N/A | No HTML-serving endpoint is introduced. |
| SECURITY-05 | Compliant | Schema-first validation is a core NFR for every MCP tool. |
| SECURITY-06 | N/A | No new IAM policy is designed in this stage; AgentCore role scoping remains from U-V3-01. |
| SECURITY-07 | N/A | No network configuration is introduced. |
| SECURITY-08 | Compliant | Tool registry preserves application-level access control by requiring user-scoped runtime dispatch and excluding unsafe routes. |
| SECURITY-09 | Compliant | Safe errors and no internal/provider details in outputs are required. |
| SECURITY-10 | Compliant | Existing lockfile remains required; any new parser dependency must be official and locked. |
| SECURITY-11 | Compliant | Tool registry isolates publication policy and considers misuse through unsafe route exclusion and side-effect approval. |
| SECURITY-12 | Compliant | Cognito-backed identity from U-V3-01 remains the source of user identity; no credentials are introduced. |
| SECURITY-13 | Compliant | Untrusted tool args must be schema-validated; drift detection verifies data/software integrity of generated schema. |
| SECURITY-14 | Compliant | Security-relevant tool failures remain auditable through U-V3-01 audit envelope; schema NFRs prevent silent unsafe publication. |
| SECURITY-15 | Compliant | Unknown tools, invalid args, missing approval, and schema drift fail closed. |

Blocking findings: None.
