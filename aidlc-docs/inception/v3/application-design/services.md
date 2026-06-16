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

## S-V3-05: Voice Agent Tool Service

**種別**: Chrome extension / ElevenLabs clientTools

**責務**:

- Register read and write tool handlers with ElevenLabs.
- Attach Cognito JWT only to SABOROU API/MCP calls, never to ElevenLabs WebSocket auth.
- Prefer real AgentCore path when verified.
- Keep Hono direct fallback for demo resilience.

---

## S-V3-06: Verification Service

**種別**: Documentation + scripts/manual commands

**責務**:

- Verify CDK synth and stack outputs.
- Verify AgentCore Gateway target is active.
- Verify selected MCP tools with real credentials.
- Verify ElevenLabs Agent conversation calls SABOROU tools.
- Verify Slack reply and `@Claude` delegation in a test channel.
