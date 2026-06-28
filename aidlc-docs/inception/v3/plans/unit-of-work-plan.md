# Unit of Work Plan - SABOROU v3 MCP Serverization

**作成日**: 2026-06-16
**対象**: SABOROU MCP Serverization Units Generation
**ステータス**: Planning Complete - Approval Required

---

## Planning Context

Units Generation は実施する。v3 は `pkgs/cdk`、`pkgs/backend`、`pkgs/extension`、OpenAPI schema、実AWS/AgentCore/ElevenLabs検証にまたがるため、単一Unitではなく複数Unitに分解する。

標準AI-DLCルールは `aidlc-docs/inception/application-design/` を出力先としているが、このリポジトリでは v3 成果物を `aidlc-docs/inception/v3/` 配下で管理しているため、Units Generation成果物は次に配置する。

- `aidlc-docs/inception/v3/units/unit-of-work.md`
- `aidlc-docs/inception/v3/units/unit-of-work-dependency.md`
- `aidlc-docs/inception/v3/units/unit-of-work-story-map.md`

---

## Part 1 Planning Checklist

- [x] Step 1: Review v3 requirements, user stories, workflow plan, and application design.
- [x] Step 2: Confirm brownfield decomposition strategy.
- [x] Step 3: Evaluate story grouping, dependency, team alignment, technical, business-domain, and code-organization categories.
- [x] Step 4: Define the recommended unit sequence.
- [x] Step 5: Define mandatory generation artifacts.
- [x] Step 6: Prepare approval gate before generating unit artifacts.

---

## Recommended Decomposition Strategy

Use a dependency-first, risk-first decomposition. The highest-risk boundary is identity and authorization between ElevenLabs, AgentCore Gateway, and SABOROU user-scoped resources. That must be implemented before tool expansion or side-effect tools.

Recommended units:

| Order | Unit | Primary Packages | Purpose |
|-------|------|------------------|---------|
| 1 | U-V3-01 mcp-transport-auth-adapter | `pkgs/cdk`, `pkgs/backend` | Establish remote MCP transport, identity resolution, and adapter boundary. |
| 2 | U-V3-02 mcp-tool-registry-schema | `pkgs/cdk`, `pkgs/backend`, `pkgs/shared` | Expand and test the MCP tool allowlist and schema synchronization. |
| 3 | U-V3-03 slack-claude-delegation | `pkgs/backend`, `pkgs/agent` | Add approved `@Claude` delegation API/tool. |
| 4 | U-V3-04 elevenlabs-registration-fallback | `pkgs/extension`, `pkgs/cdk`, docs | Register MCP as `streamable_http` primary or `sse` fallback; keep extension fallback behavior. |
| 5 | U-V3-05 real-integration-verification | all affected packages + docs | Prove real AWS/AgentCore/ElevenLabs/Slack demo path and troubleshooting. |

---

## Category Evaluation

### Story Grouping

**Decision**: Group stories by architectural risk and deployable boundary, not by user journey alone.

**Rationale**: US-V3-01 through US-V3-05 depend on correct auth, MCP tool contracts, and side-effect approval. Grouping by user journey first would hide shared gateway/auth risk.

### Dependencies

**Decision**: U-V3-01 must precede all other implementation units. U-V3-02 can begin after the adapter contract is stable. U-V3-03 depends on U-V3-02 tool registry conventions. U-V3-04 depends on a stable MCP endpoint. U-V3-05 runs last.

### Team Alignment

**Decision**: Treat this as a single AI-assisted engineering stream with package-focused checkpoints, not separate team-owned services.

### Technical Considerations

**Decision**: Keep existing Hono API fallback intact. Do not weaken JWT authorizers. Prefer `streamable_http`; add `sse` bridge only if compatibility testing blocks the primary path.

### Business Domain

**Decision**: Separate read/context tools from side-effect tools. Slack send, Slack sync, Google/Gmail fetch, and `@Claude` delegation require explicit approval metadata.

### Code Organization

**Decision**: Brownfield project. No new top-level package by default. Add code inside existing package boundaries unless Construction design proves a separate MCP facade package is lower risk.

---

## Clarification Questions

The following questions are included to satisfy the Units Generation planning gate. Recommended answers are preselected from the approved v3 requirements and application design. Change an answer only if you want to override the decomposition.

### Question 1
What should be the primary Unit grouping strategy?

A) Risk-first architecture grouping: auth/transport first, schema second, side-effect tools third, registration and verification last
B) User-journey grouping: task readout, Slack reply, Google/Slack context, Claude delegation, verification
C) Package grouping: CDK, backend, extension, docs
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2
Which MCP transport should define the first implementation path for Units Generation?

A) `streamable_http` first, with `sse` bridge as fallback only if real compatibility testing requires it
B) `sse` first, with `streamable_http` deferred
C) Build both transports in the first unit
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3
How should browser `clientTools` be treated in the unit breakdown?

A) Fallback/UI support only; the primary MCP path is ElevenLabs Dashboard remote MCP registration
B) Primary path; browser `clientTools` call SABOROU and simulate MCP behavior
C) Remove browser `clientTools` entirely in v3
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4
Should `@Claude` delegation be grouped with general Slack reply tools or kept as its own unit?

A) Keep as its own unit because it has a distinct side-effect contract and approval semantics
B) Merge into the schema/tool registry unit
C) Merge into the verification unit
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5
Should a new top-level package be created for the MCP facade?

A) No by default; use existing `pkgs/backend` and `pkgs/cdk` boundaries unless Construction proves a separate package is lower risk
B) Yes; create a new `pkgs/mcpserver` package immediately
C) Decide during Code Generation without documenting a default
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Part 2 Generation Checklist

When this plan is approved, execute these steps exactly:

- [x] Generate `aidlc-docs/inception/v3/units/unit-of-work.md` with unit definitions, scope, package boundaries, DoD, and stage execution needs.
- [x] Generate `aidlc-docs/inception/v3/units/unit-of-work-dependency.md` with dependency matrix, implementation order, Mermaid dependency diagram, and text alternative.
- [x] Generate `aidlc-docs/inception/v3/units/unit-of-work-story-map.md` mapping US-V3-01 through US-V3-09 and FR/GAP/NFR references to units.
- [x] Validate unit boundaries and confirm no circular dependencies.
- [x] Ensure every v3 user story maps to at least one unit.
- [x] Update this plan checklist immediately after each generation step.
- [x] Update `aidlc-docs/aidlc-state.md` and `aidlc-docs/audit.md`.

---

## Approval Gate

**Unit of work plan complete. Review the plan in `aidlc-docs/inception/v3/plans/unit-of-work-plan.md`. Ready to proceed to generation?**
