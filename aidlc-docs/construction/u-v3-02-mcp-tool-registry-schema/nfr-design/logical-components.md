# Logical Components - U-V3-02 mcp-tool-registry-schema

**作成日**: 2026-06-17 JST
**Unit**: U-V3-02 mcp-tool-registry-schema
**ステータス**: Review Required

---

## Component Summary

U-V3-02 adds registry and schema-validation components around the U-V3-01 MCP adapter. These components do not replace the identity boundary; they constrain which tools can be invoked and what schemas they must obey.

---

## LC-U3-02-01: McpToolRegistry

**Responsibility**:

- Own the approved MCP tool list.
- Provide tool lookup by name.
- Provide metadata for runtime precheck and schema validation.

**Inputs**:

- Static TypeScript definitions.

**Outputs**:

- `McpToolDefinition`
- `McpToolName[]`
- tool lookup map

**NFR Support**:

- Allowlist security
- Static warm-path performance
- Maintainability

---

## LC-U3-02-02: ToolSchemaCatalog

**Responsibility**:

- Own runtime Zod input schemas and output schema metadata.
- Normalize common schema fragments such as task ID, Slack channel ID, approval metadata, and voice summary fields.

**Inputs**:

- Existing shared schemas where available.
- U-V3-02-specific Zod schemas where route schemas are missing or too broad.

**Outputs**:

- validated tool args
- output schema metadata for tests/OpenAPI

**NFR Support**:

- Input validation
- Output data minimization
- Fail-safe defaults

---

## LC-U3-02-03: SideEffectPolicy

**Responsibility**:

- Enforce relationship between `effect` and `requiresHumanApproval`.
- Provide a single approval decision helper for precheck.

**Inputs**:

- tool definition
- invocation approval metadata

**Outputs**:

- allow/deny side-effect execution

**NFR Support**:

- Side-effect approval enforcement
- Application-level access control
- Fail closed behavior

---

## LC-U3-02-04: OpenApiSchemaArtifact

**Responsibility**:

- Represent `pkgs/cdk/schemas/saborou-openapi.yaml` as the AgentCore deployment artifact.
- Carry `saborou_*` operationIds and AI-oriented descriptions.

**Inputs**:

- registry definitions
- backend route mapping

**Outputs**:

- AgentCore-readable OpenAPI 3.1 YAML

**NFR Support**:

- Demo availability
- Maintainability
- AgentCore deployment compatibility

---

## LC-U3-02-05: SchemaDriftDetector

**Responsibility**:

- Parse OpenAPI YAML in tests.
- Compare against registry and exclusion list.
- Produce failure details for missing, unexpected, mismatched, unsafe, description, and schema failures.

**Inputs**:

- `McpToolRegistry`
- `OpenApiSchemaArtifact`
- `ExcludedRoutePolicy`

**Outputs**:

- test pass/fail
- `SchemaDriftReport`

**NFR Support**:

- Schema drift prevention
- Software/data integrity verification
- Build-before-deploy resilience

---

## LC-U3-02-06: ExcludedRoutePolicy

**Responsibility**:

- Define route patterns that must never appear in AgentCore schema.

**Excluded categories**:

- health/system
- OAuth start/callback
- webhooks
- destructive delete/update routes
- connection management
- UI-only helper routes

**NFR Support**:

- Allowlist security
- Misuse prevention
- Application-level access control

---

## LC-U3-02-07: McpRuntimeDispatcher Integration

**Responsibility**:

- Use registry lookup and schema validation before forwarding to backend behavior.
- Preserve U-V3-01 identity and audit flow.

**Inputs**:

- `McpToolContext`
- raw tool args
- registry metadata

**Outputs**:

- safe tool result
- safe tool error
- audit event status

**NFR Support**:

- Runtime fail closed
- Input validation
- Side-effect approval

---

## LC-U3-02-08: ReservedDelegationContract

**Responsibility**:

- Describe `saborou_delegate_task_to_claude` for downstream U-V3-03 without executing Slack side effects in U-V3-02.

**Design options for Code Generation**:

| Option | Behavior |
|--------|----------|
| Reserved unpublished | Registry contains contract but `enabledInMcp = false` until U-V3-03. |
| Reserved published | Schema contains tool but runtime returns safe not-implemented. |

Preferred for U-V3-02:

- Reserved unpublished unless downstream schema completeness requires otherwise.

**NFR Support**:

- Availability
- Maintainability
- Fail-safe defaults

---

## Component Interaction Rules

1. `McpRuntimeDispatcher` must call `McpToolRegistry` before schema validation.
2. `ToolSchemaCatalog` must validate args before any domain call.
3. `SideEffectPolicy` must run before any write or external-post dispatch.
4. `SchemaDriftDetector` must run in tests, not runtime.
5. `OpenApiSchemaArtifact` must not be accepted if it includes excluded routes.
6. `ReservedDelegationContract` must not post to Slack in U-V3-02.

---

## Verification Mapping

| Component | Verification |
|-----------|--------------|
| McpToolRegistry | Exact tool list and metadata tests. |
| ToolSchemaCatalog | Input/output schema tests. |
| SideEffectPolicy | Approval invariant tests. |
| OpenApiSchemaArtifact | CDK/schema parsing tests. |
| SchemaDriftDetector | Missing/unexpected/mismatch fixture tests or direct schema tests. |
| ExcludedRoutePolicy | Excluded path assertions. |
| McpRuntimeDispatcher Integration | Route/precheck tests. |
| ReservedDelegationContract | No side-effect or unpublished contract test. |
