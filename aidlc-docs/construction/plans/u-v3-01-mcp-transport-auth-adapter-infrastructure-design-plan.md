# Infrastructure Design Plan - U-V3-01 mcp-transport-auth-adapter

**作成日**: 2026-06-17 JST
**対象Unit**: U-V3-01 mcp-transport-auth-adapter
**ステータス**: Complete

---

## Context

U-V3-01 のInfrastructure Designは、既存 `SaborouApiStack` と `SaborouAgentCoreStack` を安全に拡張し、MCP adapter path、アクセスログ、IAM境界、JWT route preservation、CloudWatch監視の設計を具体化する。

---

## Checklist

- [x] Step 1: Analyze Functional Design, NFR Requirements, and NFR Design.
- [x] Step 2: Inspect existing CDK API and AgentCore stack structure.
- [x] Step 3: Map logical components to AWS resources and CDK changes.
- [x] Step 4: Define API Gateway route/auth/logging design.
- [x] Step 5: Define AgentCore Gateway role and target boundary design.
- [x] Step 6: Define monitoring, alerting, retention, and test assertions.
- [x] Step 7: Generate Infrastructure Design artifacts.
- [x] Step 8: Update AI-DLC state and audit log.

---

## Clarification Questions

No additional clarification questions are required.

Reason:

- AWS/CDK is already the accepted infrastructure stack.
- Existing brownfield stacks constrain the implementation to `SaborouApiStack` and `SaborouAgentCoreStack`.
- Security Baseline is enabled and non-negotiable.
- Exact AgentCore data-plane forwarding behavior must be verified in U-V3-05, but U-V3-01 can define a fail-closed infrastructure shape.

[Answer]: Fast-track Infrastructure Design using approved NFR Design.
