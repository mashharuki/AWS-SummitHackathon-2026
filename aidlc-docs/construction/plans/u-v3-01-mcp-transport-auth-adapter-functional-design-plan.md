# Functional Design Plan - U-V3-01 mcp-transport-auth-adapter

**作成日**: 2026-06-16
**対象Unit**: U-V3-01 mcp-transport-auth-adapter
**ステータス**: Complete

---

## Context

U-V3-01 は、ElevenLabs / AgentCore からのMCP呼び出しが SABOROU のユーザー別リソースに安全に到達するための基盤Unitである。現状の `authMiddleware` は API Gateway JWT Authorizer が注入する `requestContext.authorizer.jwt.claims.sub` のみを `userId` として扱う。一方、AgentCore Gateway Target は `GATEWAY_IAM_ROLE` を使うため、既存Honoルートをそのまま呼ぶとJWT Authorizerとユーザー同一性の不整合が起きる。

---

## Checklist

- [x] Step 1: Analyze U-V3-01 unit scope and dependencies.
- [x] Step 2: Review existing backend auth middleware and CDK AgentCore/API Gateway boundaries.
- [x] Step 3: Define domain entities for MCP invocation, identity, authorization, and audit events.
- [x] Step 4: Define business rules for user identity, approval, error handling, and logging.
- [x] Step 5: Define business logic model and main flows.
- [x] Step 6: Generate Functional Design artifacts.
- [x] Step 7: Update AI-DLC state and audit log.

---

## Clarification Questions

No additional clarification questions are required for this functional design.

The approved Application Design already decides:

- Existing Hono JWT routes must remain protected.
- IAM role identity alone must not authorize user resources.
- MCP identity must be explicitly resolved before accessing task, Slack, or Google resources.
- Tool-call logs must not contain tokens or message bodies.
- `streamable_http` is the primary ElevenLabs MCP registration path, with `sse` only as fallback in later units.

[Answer]: Fast-track functional design with approved Application Design decisions.
