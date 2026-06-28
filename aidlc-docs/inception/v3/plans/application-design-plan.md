# Application Design Plan - SABOROU v3 MCP Serverization

**作成日**: 2026-06-16
**対象**: AgentCore Gateway本命のMCP化、Hono API認証整合、OpenAPI同期、Slack `@Claude` 委譲

---

## Planning Decision

Application Designは実施する。追加質問は作成しない。理由は、Requirements AnalysisとWorkflow Planningで以下が確定済みであり、残る論点はユーザー判断ではなく技術設計上の安全な選択だから。

- AgentCore Gatewayを本命とする
- Security Baselineを有効にする
- 既存Cognito/JWT認可を壊さない
- `@Claude` 委譲は副作用ツールとして明示承認必須にする
- 実AWS / AgentCore / ElevenLabs接続検証を完了条件にする

---

## Design Checklist

- [x] Step 1: Identify v3 components and responsibilities.
- [x] Step 2: Define component methods and high-level interfaces.
- [x] Step 3: Define services and orchestration patterns.
- [x] Step 4: Define component dependencies and data flow.
- [x] Step 5: Resolve SECURITY-02 and SECURITY-08 blocking gaps at design level.
- [x] Step 6: Consolidate design into `application-design.md`.

---

## Mandatory Artifacts

- [x] Generate `components.md`.
- [x] Generate `component-methods.md`.
- [x] Generate `services.md`.
- [x] Generate `component-dependency.md`.
- [x] Generate consolidated `application-design.md`.

---

## Design Constraints

- Existing Hono direct API fallback must remain intact.
- Do not weaken Cognito JWT authorization for existing browser/extension routes.
- AgentCore path must carry or derive a trustworthy user identity before accessing user-scoped resources.
- Slack posting and `@Claude` delegation are side-effect tools and require explicit user approval.
- OpenAPI tool publication must be allowlist-based.

---

## Approval

This plan proceeds from the approved Workflow Planning request.

[Answer]: Approved by user request to proceed to Application Design.

---

## Revision Checklist

- [x] Revision 1: Reflect ElevenLabs Dashboard MCP server type constraint.
- [x] Revision 1: Constrain remote MCP transport to `streamable_http` or `sse`.
- [x] Revision 1: Clarify that extension `clientTools` is fallback/UI support, not the primary MCP path.
