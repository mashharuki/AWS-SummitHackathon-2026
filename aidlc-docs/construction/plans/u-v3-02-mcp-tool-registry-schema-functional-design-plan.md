# Functional Design Plan - U-V3-02 mcp-tool-registry-schema

**作成日**: 2026-06-17 JST
**Unit**: U-V3-02 mcp-tool-registry-schema
**ステータス**: Completed - Review Required

---

## Plan Checklist

- [x] Step 1: Read U-V3-02 unit definition and story map.
- [x] Step 2: Read v3 requirements, application component methods, existing AgentCore OpenAPI schema, and backend route surfaces.
- [x] Step 3: Identify MCP-publishable tool candidates and explicitly excluded routes.
- [x] Step 4: Define domain entities for tool registry, tool contract, schema source, side-effect policy, and schema drift report.
- [x] Step 5: Define business rules for allowlist, operationId naming, input/output validation, side-effect approval, and schema synchronization.
- [x] Step 6: Define business logic model for registry generation, schema publication, runtime dispatch, and drift detection.
- [x] Step 7: Create functional design artifacts under `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/functional-design/`.

---

## Clarification Assessment

No blocking clarification questions are required before Functional Design.

The following decisions are already fixed by approved v3 requirements and Unit of Work:

- Publish voice-callable SABOROU APIs, not OAuth callbacks, webhooks, health checks, or internal/admin routes.
- Treat `streamable_http`/`sse` transport compatibility as U-V3-04, not U-V3-02.
- Reserve `saborou_delegate_task_to_claude` contract but implement behavior in U-V3-03.
- Fix schema drift between backend and AgentCore schema by introducing a single registry source or mandatory drift tests.
- Explicitly classify side-effect tools and require approval metadata.

---

## Artifacts

- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/functional-design/domain-entities.md`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/functional-design/business-rules.md`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/functional-design/business-logic-model.md`
