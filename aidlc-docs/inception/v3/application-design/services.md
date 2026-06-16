# SABOROU v3 Service Design

**作成日**: 2026-06-16

---

## S-V3-01: AgentCore MCP Gateway Service

**種別**: Managed MCP Gateway
**Endpoint**: `https://<gatewayId>.gateway.bedrock-agentcore.<region>.amazonaws.com`

**責務**:

- Cognito Custom JWTでElevenLabs/extension callerを検証する。
- AgentCore Gateway Targetへtool callをルーティングする。
- Tool descriptions and schemasをAgentに公開する。

**Design Notes**:

- Current OpenAPI Target + `GATEWAY_IAM_ROLE` alone is insufficient if downstream HTTP API requires Cognito JWT Authorizer.
- Application design selects an adapter/facade boundary so user identity is explicit before user-scoped resource access.

---

## S-V3-02: MCP Tool Adapter Service

**種別**: Lambda/Hono adapter service
**Endpoint**: Internal to AgentCore target or Hono MCP facade route

**責務**:

- Resolve user identity for Gateway-originated requests.
- Validate tool input against registry schemas.
- Dispatch to task, proposal, Google, Slack, and delegation operations.
- Enforce human approval for side-effect tools.
- Return normalized JSON output to AgentCore.

**提供インタフェース**:

| Method | Purpose |
|--------|---------|
| `invokeTool` | Dispatch MCP tool call |
| `resolveIdentity` | Convert request context to userId |
| `assertApproval` | Enforce approval on side-effect tools |

---

## S-V3-03: Hono API Service

**種別**: REST API on Lambda
**Endpoint**: Existing API Gateway HTTP API

**責務**:

- Preserve existing browser/extension direct API routes.
- Continue enforcing Cognito JWT authorization for existing routes.
- Provide reusable services/repositories for MCP adapter.

**提供インタフェース**:

| Method | Path | MCP Exposure |
|--------|------|--------------|
| GET | `/api/tasks` | Yes |
| GET | `/api/tasks/{id}` | Yes |
| POST | `/api/tasks` | Yes |
| POST | `/api/proposals/judge` | Yes, with semantics clarified |
| POST | `/api/slack/reply` | Yes, side-effect approval required |
| POST | `/api/slack/delegate-claude` | New, side-effect approval required |
| GET | `/api/slack/channels` | Yes |
| POST | `/api/slack/sync-messages` | Yes, approval required |
| GET | `/api/google/calendar/status` | Yes |
| POST | `/api/google/calendar/fetch` | Yes, approval required |
| POST | `/api/google/gmail/fetch` | Yes, approval required |

---

## S-V3-04: Slack Delegation Service

**種別**: Backend domain service

**責務**:

- Load user-owned task.
- Build actionable `@Claude` message.
- Fetch per-user Slack token.
- Post to approved Slack channel/thread.
- Return safe result.

**Side-effect Policy**:

- Requires `humanApproved === true`.
- Requires explicit `channelId`.
- Does not guarantee Claude execution result.

---

## S-V3-05: ElevenLabs Remote MCP Registration Service

**種別**: ElevenLabs Dashboard remote MCP server registration

**責務**:

- Register SABOROU MCP server as `streamable_http` or `sse`.
- Prefer `streamable_http` when AgentCore Gateway and ElevenLabs verification proves compatibility.
- Use an `sse` bridge only if `streamable_http` compatibility is blocked.
- Keep browser `clientTools` out of the primary MCP path; reserve them for UI support or Hono fallback.
- Attach Cognito/JWT context only to SABOROU MCP/API calls, never to ElevenLabs conversation transport auth.

**Transport Decision**:

| Transport | Priority | Use When |
|-----------|----------|----------|
| `streamable_http` | Primary | AgentCore Gateway can be registered and invoked directly from ElevenLabs Dashboard. |
| `sse` | Fallback | Dashboard requires SSE behavior or AgentCore Streamable HTTP compatibility is not proven. |

---

## S-V3-06: Verification Service

**種別**: Documentation + scripts/manual commands

**責務**:

- Verify CDK synth and stack outputs.
- Verify AgentCore Gateway target is active.
- Verify selected MCP tools with real credentials.
- Verify ElevenLabs Dashboard registration with `streamable_http`.
- Verify `sse` bridge only if selected by compatibility testing.
- Verify ElevenLabs Agent conversation calls SABOROU tools through the registered MCP server.
- Verify Slack reply and `@Claude` delegation in a test channel.
