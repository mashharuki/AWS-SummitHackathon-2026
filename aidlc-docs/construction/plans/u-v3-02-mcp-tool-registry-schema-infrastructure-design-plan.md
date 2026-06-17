# Infrastructure Design Plan - U-V3-02 mcp-tool-registry-schema

**作成日**: 2026-06-17 JST
**Unit**: U-V3-02 mcp-tool-registry-schema
**ステータス**: Completed - Review Required

---

## Plan Checklist

- [x] Step 1: Read U-V3-02 functional design, NFR requirements, and NFR design artifacts.
- [x] Step 2: Read existing CDK/AgentCore schema deployment context.
- [x] Step 3: Map logical components to existing infrastructure and code artifacts.
- [x] Step 4: Define CDK change set for schema asset, GatewayTarget, and tests.
- [x] Step 5: Define deployment architecture and validation gates.
- [x] Step 6: Evaluate Security Baseline applicability for infrastructure design.
- [x] Step 7: Create infrastructure design artifacts.

---

## Clarification Assessment

No blocking infrastructure questions are required.

Rationale:

- Cloud provider and deployment target are already AWS CDK.
- Existing `SaborouAgentCoreStack` already owns schema bucket deployment and GatewayTarget.
- U-V3-02 does not introduce new compute, database, queue, VPC, or user-facing network intermediaries.
- The correct infrastructure move is to preserve existing construct IDs and strengthen schema artifact validation.

---

## Artifacts

- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/infrastructure-design/infrastructure-design.md`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/infrastructure-design/deployment-architecture.md`
