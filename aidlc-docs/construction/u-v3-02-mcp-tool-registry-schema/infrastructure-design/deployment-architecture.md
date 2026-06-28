# Deployment Architecture - U-V3-02 mcp-tool-registry-schema

**作成日**: 2026-06-17 JST
**Unit**: U-V3-02 mcp-tool-registry-schema
**ステータス**: Review Required

---

## Architecture Summary

U-V3-02 deploys through the existing AgentCore schema artifact path. The runtime MCP adapter from U-V3-01 remains the execution boundary. This unit changes which tools are published and how schema drift is prevented before CDK deployment.

---

## Deployment Components

| Component | Location | Deployment Role |
|-----------|----------|-----------------|
| MCP registry | `pkgs/backend/src/mcp/registry.ts` | Runtime policy and validation source. |
| Tool schemas | `pkgs/backend/src/mcp/` | Runtime argument validation and output normalization source. |
| AgentCore OpenAPI YAML | `pkgs/cdk/schemas/saborou-openapi.yaml` | Deployed schema artifact consumed by GatewayTarget. |
| Schema bucket | `SaborouAgentCoreStack.SchemaBucket` | Private encrypted storage for OpenAPI YAML. |
| Bucket deployment | `SaborouAgentCoreStack.DeploySchema` | Uploads schema artifact during CDK deployment. |
| Gateway target | `SaborouAgentCoreStack.HonoApiTarget` | Maps OpenAPI operations to AgentCore MCP tools. |
| Schema drift tests | `pkgs/cdk/test/agentcore-schema.test.ts` | Blocks unsafe or drifted schema before deployment. |

---

## Deployment Sequence

1. Developer updates MCP registry and OpenAPI schema in the repository.
2. Backend tests validate registry metadata, input schemas, side-effect policy, and runtime precheck.
3. CDK schema tests parse OpenAPI YAML and compare against the approved tool list.
4. CDK stack tests verify AgentCore GatewayTarget still points to the schema artifact.
5. CDK build compiles infrastructure code.
6. CDK deployment uploads schema files from `pkgs/cdk/schemas` to the existing S3 schema bucket.
7. AgentCore GatewayTarget reads the schema and exposes approved MCP tools.
8. U-V3-05 verifies real AgentCore and ElevenLabs behavior.

---

## Tool Publication Boundary

Published operations must map to the MCP adapter route introduced in U-V3-01:

- API Gateway path: `/api/mcp/tools/{toolName}`
- Lambda route: `/api/mcp/tools/:toolName`
- Runtime registry dispatches the logical tool.

This keeps AgentCore IAM access scoped to the MCP adapter route and prevents publishing direct internal Hono routes as tools.

---

## OpenAPI Target Strategy

Preferred schema shape:

- One OpenAPI operation per approved MCP tool.
- OperationId equals approved tool name.
- Path routes through the MCP adapter boundary.
- Request body contains tool-specific args and approval metadata where required.
- Descriptions explain the real business action, even though the transport path is adapter-based.

Reason:

- U-V3-01 narrowed AgentCore role to `POST /api/mcp/tools/*`.
- Publishing direct `/api/tasks`, `/api/slack/reply`, or `/api/google/*` paths would conflict with the scoped role and bypass the adapter policy boundary.

---

## Validation Gates

Code Generation must pass:

- `pnpm --filter backend test`
- `pnpm --filter backend typecheck`
- `pnpm --filter cdk test`
- `pnpm --filter cdk build`

Schema-specific gates:

- All operationIds start with `saborou_`.
- Expected operationIds exist.
- Unexpected operationIds fail.
- Excluded routes fail.
- Side-effect vendor metadata is consistent with registry.
- Descriptions are present and not generic.
- Output schemas do not contain forbidden secret/raw-provider fields.

---

## Failure Handling

| Failure | Deployment Behavior |
|---------|---------------------|
| Registry/schema drift | Tests fail before CDK deploy. |
| Unsafe route appears in YAML | Tests fail before CDK deploy. |
| Missing operation description | Tests fail before CDK deploy. |
| Missing approval metadata on side-effect tool | Tests fail before CDK deploy. |
| Runtime unknown tool | Adapter returns `TOOL_NOT_ALLOWED`. |
| Runtime invalid args | Adapter returns `VALIDATION_ERROR`. |
| Runtime missing approval | Adapter returns `FORBIDDEN`. |

---

## Operations Impact

No new AWS operational resource is added in U-V3-02.

Operational impact:

- AgentCore tool list changes after schema deployment.
- Existing schema bucket deployment continues to handle artifact upload.
- Existing CloudWatch logs and alarms from U-V3-01 cover runtime adapter failures.
- Real tool visibility and invocation must be verified in U-V3-05.

---

## Residual Risk

AgentCore's exact OpenAPI-to-MCP behavior and ElevenLabs Dashboard MCP registration behavior require real verification in U-V3-05. U-V3-02 reduces deployment risk by ensuring only approved and schema-valid tools are published before that real integration test.
