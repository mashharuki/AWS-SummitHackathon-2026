# Infrastructure Design - U-V3-02 mcp-tool-registry-schema

**作成日**: 2026-06-17 JST
**Unit**: U-V3-02 mcp-tool-registry-schema
**ステータス**: Review Required

---

## Design Summary

U-V3-02 does not need new AWS runtime infrastructure. It strengthens the schema artifact and deployment validation path used by the existing AgentCore Gateway stack.

Primary infrastructure decision:

- Keep the existing `SaborouAgentCoreStack` schema bucket, bucket deployment, gateway, and target constructs.
- Update the deployed OpenAPI schema artifact and add deterministic tests that prevent unsafe or drifted schema deployment.

---

## Existing AWS Resource Mapping

| Logical Component | Existing AWS/CDK Resource | Stack | U-V3-02 Design |
|-------------------|---------------------------|-------|----------------|
| `OpenApiSchemaArtifact` | `pkgs/cdk/schemas/saborou-openapi.yaml` | `SaborouAgentCoreStack` | Expand and normalize operationIds to approved `saborou_*` tools. |
| `SchemaArtifactStore` | `AWS::S3::Bucket` `SchemaBucket` | `SaborouAgentCoreStack` | Reuse existing encrypted/private schema bucket. |
| `SchemaArtifactDeployment` | `s3deploy.BucketDeployment` `DeploySchema` | `SaborouAgentCoreStack` | Reuse existing deployment path; do not rename construct IDs. |
| `AgentCoreGatewayTarget` | `AWS::BedrockAgentCore::GatewayTarget` `HonoApiTarget` | `SaborouAgentCoreStack` | Reuse target; it consumes updated schema artifact. |
| `McpToolRegistry` | Backend TypeScript module | `pkgs/backend` | Static registry used at runtime and by tests. |
| `SchemaDriftDetector` | Backend/CDK test code | `pkgs/backend`, `pkgs/cdk` | Add deterministic validation before deploy. |
| `ExcludedRoutePolicy` | Test-owned route pattern list | `pkgs/cdk/test` or backend tests | Block unsafe schema publication. |

---

## CDK Resource Strategy

### Preserve Construct IDs

The following existing construct IDs must not be renamed in U-V3-02:

- `SchemaBucket`
- `DeploySchema`
- `Gateway`
- `HonoApiTarget`
- `GatewayRole`

Reason:

- CDK construct ID changes can cause CloudFormation logical ID changes and resource replacement.
- U-V3-02 only changes schema content and tests, not resource identity.

### No New Runtime AWS Resources

U-V3-02 should not add:

- Lambda functions
- DynamoDB tables
- SQS/SNS/EventBridge resources
- VPC/network resources
- API Gateway routes

Reason:

- U-V3-01 already introduced the MCP adapter route and infrastructure boundary.
- U-V3-02 is a schema/registry correctness unit.

---

## Schema Artifact Design

`pkgs/cdk/schemas/saborou-openapi.yaml` remains the AgentCore schema deployment artifact.

Required schema content changes for Code Generation:

- Replace implementation-oriented operationIds with approved `saborou_*` operationIds.
- Add missing voice-callable tools from U-V3-02.
- Remove non-existing or unsafe operations such as `streamProposal` unless explicitly backed by a real route and allowlisted.
- Add AI-oriented English descriptions.
- Add request/response schemas with required fields and bounds.
- Represent approval requirements in descriptions and/or vendor extension metadata.

Recommended vendor extension:

- `x-saborou-effect`: `read`, `write`, or `external-post`
- `x-saborou-requires-approval`: boolean
- `x-saborou-implementation-status`: `implemented` or `reserved`

These extensions are for SABOROU tests and documentation; AgentCore may ignore them.

---

## Registry And Schema Validation Placement

Backend package:

- Owns runtime `McpToolRegistry`.
- Owns runtime schema validation tests.
- Owns side-effect approval invariant tests.

CDK package:

- Owns OpenAPI YAML parse/drift test.
- Owns AgentCore stack assertions.
- Owns schema asset deployment assertions.

Recommended test files:

- `pkgs/backend/src/__tests__/mcp/registry.test.ts`
- `pkgs/cdk/test/agentcore-schema.test.ts`

---

## Dependency Design

YAML parsing is needed only for tests.

Preferred placement:

- Add `yaml` as a dev dependency to `pkgs/cdk` if no existing YAML parser is available.

Constraints:

- Do not add YAML parser to Lambda runtime dependencies unless runtime generation is intentionally implemented.
- Keep dependency lockfile updated.
- Use official npm package only.

---

## Deployment Flow

1. Backend registry and tests validate runtime publication policy.
2. CDK schema tests parse `pkgs/cdk/schemas/saborou-openapi.yaml`.
3. Tests compare schema operations against registry-derived expected list or a mirrored fixture.
4. CDK build/test passes.
5. Existing `DeploySchema` uploads schema to private encrypted S3 bucket.
6. Existing `HonoApiTarget` consumes the updated schema from S3.
7. AgentCore Gateway exposes MCP tools from the updated schema.

---

## Security Baseline Compliance

| Rule | Infrastructure Design Status |
|------|------------------------------|
| SECURITY-01 | Compliant by reuse: existing schema bucket is encrypted, private, and SSL enforced. |
| SECURITY-02 | N/A: no new network intermediary is added in U-V3-02. |
| SECURITY-03 | Compliant by design: schema excludes raw provider payloads; runtime audit remains U-V3-01. |
| SECURITY-05 | Requires schema validation for all tool inputs before dispatch. |
| SECURITY-06 | Compliant by reuse: no new IAM permissions are added; existing AgentCore role remains scoped from U-V3-01. |
| SECURITY-07 | N/A: no VPC/network topology change. |
| SECURITY-08 | Requires allowlist-only schema and runtime dispatch. |
| SECURITY-09 | Requires safe output schemas and no internal/provider details. |
| SECURITY-10 | Requires locked official test dependency if YAML parser is added. |
| SECURITY-11 | Registry isolates MCP publication policy and abuse prevention. |
| SECURITY-12 | Compliant by reuse: Cognito-backed identity remains from U-V3-01. |
| SECURITY-13 | Drift detector verifies schema integrity before deployment. |
| SECURITY-14 | Compliant by reuse: U-V3-01 audit and alarms cover runtime failures. |
| SECURITY-15 | Requires tests to fail before deploy on drift and runtime to fail closed on unknown tools. |

Blocking findings: None at Infrastructure Design stage.

---

## Infrastructure Constraints For Code Generation

- Do not rename existing AgentCore stack constructs.
- Do not add broad IAM permissions.
- Do not add new public API routes for U-V3-02.
- Do not deploy unvalidated schema.
- Do not publish OAuth, webhook, health, destructive delete/update, or UI-helper routes.
- Do not require runtime YAML parsing.
