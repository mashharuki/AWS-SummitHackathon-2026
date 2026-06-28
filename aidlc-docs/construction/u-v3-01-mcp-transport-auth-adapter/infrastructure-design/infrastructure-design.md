# Infrastructure Design - U-V3-01 mcp-transport-auth-adapter

**作成日**: 2026-06-17 JST
**Unit**: U-V3-01 mcp-transport-auth-adapter
**ステータス**: Review Required

---

## Design Summary

U-V3-01 maps the MCP transport/auth adapter to the existing AWS CDK stacks without weakening the current browser/extension API security model.

Key decisions:

- Keep existing `/{proxy+}` HTTP API routes protected by Cognito JWT Authorizer.
- Add an explicit MCP adapter route boundary rather than making existing routes broadly public.
- Require application-level Cognito JWT verification inside the MCP adapter.
- Treat AgentCore IAM role as service-hop identity only, never user identity.
- Add API Gateway access logging and safe application audit logging.
- Preserve Lean proof evidence as a build/test artifact.

---

## AWS Resource Mapping

| Logical Component | AWS/CDK Resource | Stack | Design |
|-------------------|------------------|-------|--------|
| `McpAdapterEntry` | Existing Hono Lambda handler plus MCP route module | `SaborouApiStack` / `pkgs/backend` | Add explicit `/api/mcp/{proxy+}` or equivalent adapter path. |
| `McpIdentityResolver` | Lambda application code + Cognito JWKS/issuer/audience env vars | `SaborouApiStack` | Verify Cognito JWT in application layer for MCP path. |
| `McpPrecheckPipeline` | Lambda application code | `SaborouApiStack` | Fail closed before domain dispatch. |
| `McpSafeAuditLogger` | CloudWatch Logs structured JSON events | `SaborouApiStack` | Emit safe audit event for every attempt. |
| `RouteAuthorizerBoundary` | `AWS::ApiGatewayV2::Route` with JWT authorizer on `/{proxy+}` | `SaborouApiStack` | Existing route remains JWT-authorized. |
| `McpAdapterRouteBoundary` | Explicit API Gateway HTTP route | `SaborouApiStack` | Route forwards Authorization header to Lambda; Lambda verifies token. |
| `AgentCoreGatewayRoleBoundary` | IAM role for AgentCore Gateway | `SaborouAgentCoreStack` | Scope `execute-api:Invoke` to intended API/adapter route where CDK supports it. |
| `AgentCoreGatewayFacade` | `AWS::BedrockAgentCore::Gateway` and GatewayTarget | `SaborouAgentCoreStack` | Continue Custom JWT at Gateway; target uses service-hop credential. |
| `ApiAccessLogs` | CloudWatch LogGroup + API Gateway Stage access logs | `SaborouApiStack` | Required for SECURITY-02. |
| `SecurityAlarms` | CloudWatch MetricFilters / Alarms | `SaborouApiStack` | Alert on repeated unauthorized/forbidden MCP events. |
| `LeanVerificationEvidence` | Lean file under `aidlc-docs` | docs/build-test | Run `lean` verification in Build/Test or manual gate. |

---

## Route And Authorization Design

### Existing Direct API Routes

Existing `/{proxy+}` route remains protected by API Gateway JWT Authorizer:

- Direct browser/extension calls continue sending Cognito JWT.
- Existing `authMiddleware` continues reading `requestContext.authorizer.jwt.claims.sub`.
- Existing public exceptions remain explicit:
  - `GET /health`
  - `GET /api/auth/slack/callback`
  - `GET /api/auth/google/callback`

### MCP Adapter Route

Add an explicit MCP adapter route such as:

```text
POST /api/mcp/tools/{toolName}
```

or an equivalent route matching the AgentCore/OpenAPI target shape.

Infrastructure behavior:

- The route forwards request headers and body to the existing Hono Lambda.
- The route must not bypass application-level auth.
- Lambda-side `McpIdentityResolver` verifies Cognito JWT issuer/audience/expiration/subject before dispatch.
- If AgentCore does not forward a usable Cognito token or verified context, the adapter fails closed with `UNAUTHORIZED`.

Rejected infrastructure shortcuts:

- Do not remove the JWT authorizer from the existing `/{proxy+}` route.
- Do not treat `GATEWAY_IAM_ROLE` as SABOROU `userId`.
- Do not create a catch-all public route that reaches domain handlers without adapter precheck.

---

## Logging And Monitoring Design

### API Gateway Access Logs

Add CloudWatch access logging to the HTTP API default stage or explicit stage.

Required fields:

- requestId
- routeKey
- status
- responseLatency
- integrationStatus
- sourceIp if available
- userAgent if available

Do not log:

- Authorization header
- request body
- query values that may contain secrets

### Lambda Application Logs

Existing Lambda log group retention should be raised from 14 days to at least 90 days for Security Baseline compliance.

Required structured MCP audit fields:

- requestId
- toolName
- source
- userIdHash
- status
- durationMs

### Alerts

Add CloudWatch MetricFilters and alarms for:

- high count of `status = "unauthorized"`
- high count of `status = "forbidden"`
- high count of `status = "tool_error"`

Alarm thresholds can be tuned in Infrastructure Design implementation, but a first pass should prioritize demo/debug visibility over aggressive paging.

---

## IAM Design

### AgentCore Gateway Role

Existing design uses `bedrock-agentcore.amazonaws.com` as trust principal and `execute-api:Invoke` on the Hono HTTP API.

U-V3-01 refinement:

- Keep action-specific policy: `execute-api:Invoke`.
- Scope resource to the SABOROU HTTP API ID and, where practical, the MCP adapter path/method.
- If API Gateway ARN route wildcard is required, document the exception in cdk-nag suppression.
- Do not grant data-plane access to DynamoDB, Secrets Manager, Slack, or Google resources to the AgentCore Gateway role.

### Lambda Role

Existing Hono Lambda role keeps domain permissions. U-V3-01 should avoid adding new broad permissions.

If JWT verification requires fetching JWKS over HTTPS, no AWS IAM permission is required. If JWKS caching or parameter storage is added later, permissions must be scoped to exact resources.

---

## CDK Change Set

| File | Planned Change |
|------|----------------|
| `pkgs/cdk/lib/stacks/api-stack.ts` | Add HTTP API access log group and Stage access log settings. |
| `pkgs/cdk/lib/stacks/api-stack.ts` | Increase Hono Lambda log retention to 90 days or document environment-specific exception if not implemented. |
| `pkgs/cdk/lib/stacks/api-stack.ts` | Add explicit MCP adapter route if Code Generation implements a distinct route. |
| `pkgs/cdk/lib/stacks/api-stack.ts` | Add metric filters/alarms for MCP unauthorized/forbidden/tool_error audit statuses. |
| `pkgs/cdk/lib/stacks/agentcore-stack.ts` | Narrow or document Gateway role `execute-api:Invoke` resource scope for MCP adapter path. |
| `pkgs/cdk/test/api-stack.test.ts` | Assert access log settings, retention, route authorizer preservation, and MCP public exception boundary. |
| `pkgs/cdk/test/agentcore-stack.test.ts` | Assert Gateway role trust principal, no wildcard actions, and documented execute-api resource scope. |

---

## Security Baseline Compliance

| Rule | Infrastructure Design Status |
|------|------------------------------|
| SECURITY-02 | Requires HTTP API access logging to CloudWatch. |
| SECURITY-03 | Requires structured Lambda MCP audit events. |
| SECURITY-05 | Route forwards to adapter; input validation happens in application precheck. |
| SECURITY-06 | Gateway role action-specific and resource-scoped; wildcard route exception must be documented. |
| SECURITY-08 | Existing route authorizer preserved; MCP route uses application-level Cognito verification. |
| SECURITY-09 | Safe error mapper prevents internal details in responses. |
| SECURITY-11 | Adapter route isolates security-critical logic. |
| SECURITY-12 | Cognito remains source of user identity. |
| SECURITY-14 | Metric filters/alarms and 90-day retention designed. |
| SECURITY-15 | Fail-closed adapter route design. |

**Blocking Findings**: None at Infrastructure Design stage.

---

## Implementation Constraints For Code Generation

- Code Generation must not modify existing public route exceptions beyond explicit need.
- Code Generation must not make `/{proxy+}` unauthenticated.
- Code Generation must add tests before broadening AgentCore target scope.
- Code Generation must keep Lean verification command available.
- Code Generation must document any CDK wildcard exception with a cdk-nag suppression reason.
