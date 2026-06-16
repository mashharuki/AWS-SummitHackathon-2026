# SABOROU v3 Application Design - MCP Serverization

**作成日**: 2026-06-16
**ステータス**: Review Required

---

## Design Summary

v3のApplication Designは、AgentCore GatewayをMCP入口として維持しながら、既存Hono APIのCognito JWT認可を壊さないFacade/Adapter境界を導入する。初版要件で見つかった最大ギャップは、AgentCore OpenAPI Targetの `GATEWAY_IAM_ROLE` と API Gateway JWT Authorizerの不整合であるため、実装では既存Honoルートを無理に認証バイパスせず、MCP Tool AdapterでuserIdを明示的に解決してから既存ドメイン処理へ委譲する。

---

## Design Artifacts

- `components.md`: C-V3-01 through C-V3-07 component definitions.
- `component-methods.md`: Tool adapter, identity resolver, tool registry, Slack delegation, voice tool client, verification harness interfaces.
- `services.md`: AgentCore MCP Gateway, MCP Tool Adapter, Hono API, Slack Delegation, Voice Agent Tool, Verification services.
- `component-dependency.md`: Dependency matrix, data flow, security boundary.

---

## Key Design Decisions

### DD-V3-01: Introduce MCP Tool Adapter Boundary

Do not depend on existing Hono API Gateway JWT routes as the only downstream target for AgentCore.

**Reason**: Current API Gateway requires Cognito JWT Authorizer. AgentCore OpenAPI Target currently uses `GATEWAY_IAM_ROLE`. Without a user-aware adapter, Gateway-originated calls may fail or lose user identity.

### DD-V3-02: Preserve Existing Direct API Fallback

The extension's direct Hono fallback remains supported.

**Reason**: The v2 demo already depends on direct API fallback for resilience. v3 should improve real MCP support without breaking the working path.

### DD-V3-03: Use Allowlist-Based MCP Tool Publication

Only approved voice-callable APIs are exposed as MCP tools.

**Reason**: "All existing APIs" is too broad if interpreted literally. OAuth callbacks, webhooks, health, and internal/admin endpoints must not become agent-callable tools.

### DD-V3-04: Treat `@Claude` Delegation as a New Side-Effect Tool

`saborou_delegate_task_to_claude` is a new explicit tool/API.

**Reason**: It has different acceptance criteria from normal Slack reply: it must generate an actionable task request and mention `@Claude`.

### DD-V3-05: Separate Read Tools and Side-Effect Tools

Read tools can execute after authentication. Side-effect tools require explicit human approval metadata.

**Reason**: Slack posting, Slack sync, Google/Gmail fetch, and `@Claude` delegation can alter external state or expose information.

---

## SECURITY Blocking Gap Resolution

| Finding | Design Resolution |
|---------|-------------------|
| SECURITY-02 | Add Gateway/API tool-call logging requirements to Verification and Infrastructure Design. Tool calls must log requestId, toolName, userId hash or safe user id, status, and duration without tokens or message bodies. |
| SECURITY-08 | Add McpIdentityResolver and MCP Tool Adapter. Gateway/IAM identity alone does not authorize user resources; userId must come from verified Cognito/AgentCore context before accessing tasks, Slack, or Google resources. |

These findings are resolved at application-design level, but still require NFR Design and Infrastructure Design before Code Generation.

---

## Traceability

| Requirement / Gap | Design Element |
|-------------------|----------------|
| FR-V3-01 | AgentCoreGatewayFacade |
| FR-V3-02 | McpToolRegistry, services allowlist |
| FR-V3-03 | VoiceToolClient, AgentCore MCP Gateway Service |
| FR-V3-04 | SlackDelegationService |
| FR-V3-05 | McpToolRegistry and schema sync requirements |
| FR-V3-06 | McpIdentityResolver and McpToolAdapter |
| FR-V3-07 | McpToolAdapter contract for judge/draft semantics |
| GAP-V3-01 | Allowlist expansion in McpToolRegistry |
| GAP-V3-02 | Schema sync test requirement |
| GAP-V3-03 | Adapter boundary and identity resolver |
| GAP-V3-04 | Identity resolver output maps to userId |
| GAP-V3-05 | VoiceToolClient true Gateway path plus fallback |
| GAP-V3-06 | SlackDelegationService |
| GAP-V3-07 | Judge/draft semantics decision |
| GAP-V3-08 | McpVerificationHarness |

---

## Next Stage Input

Units Generation should split implementation into at least:

1. AgentCore auth/adapter foundation
2. MCP OpenAPI schema and allowlist tests
3. `@Claude` delegation API/tool
4. Extension voice tools alignment
5. Integration verification and demo docs
