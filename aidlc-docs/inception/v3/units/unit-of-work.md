# SABOROU v3 Unit of Work

**作成日**: 2026-06-16
**対象**: SABOROU MCP Serverization
**分解方針**: Risk-first architecture grouping

---

## Unit Summary

| Order | Unit ID | Name | Priority | Primary Packages | Depends On |
|-------|---------|------|----------|------------------|------------|
| 1 | U-V3-01 | mcp-transport-auth-adapter | Critical | `pkgs/cdk`, `pkgs/backend` | None |
| 2 | U-V3-02 | mcp-tool-registry-schema | Critical | `pkgs/cdk`, `pkgs/backend`, `pkgs/shared` | U-V3-01 |
| 3 | U-V3-03 | slack-claude-delegation | High | `pkgs/backend`, `pkgs/agent` | U-V3-01, U-V3-02 |
| 4 | U-V3-04 | elevenlabs-registration-fallback | High | `pkgs/extension`, `pkgs/cdk`, docs | U-V3-01, U-V3-02 |
| 5 | U-V3-05 | real-integration-verification | Critical | all affected packages + docs | U-V3-01, U-V3-02, U-V3-03, U-V3-04 |

---

## U-V3-01: mcp-transport-auth-adapter

**Purpose**: Establish the remote MCP transport, identity resolution, and adapter boundary so AgentCore/ElevenLabs calls cannot bypass user-scoped authorization.

**Included Scope**:

- Define the MCP Tool Adapter entry boundary in `pkgs/backend`.
- Add or adjust identity resolution for AgentCore/Gateway-authenticated calls.
- Preserve existing Hono Cognito JWT routes and direct extension API fallback.
- Define CDK/API Gateway changes required for AgentCore to reach the adapter without weakening existing JWT authorization.
- Add structured tool-call logging requirements for requestId, toolName, safe user identifier, status, and duration.

**Excluded Scope**:

- Full MCP tool allowlist expansion.
- `@Claude` delegation behavior.
- ElevenLabs Dashboard registration steps.

**Construction Stages**:

| Stage | Execute? | Rationale |
|-------|----------|-----------|
| Functional Design | Yes | Identity resolution, adapter contract, and authorization rules need detailed design. |
| NFR Requirements | Yes | Security, logging, latency, and reliability are central risks. |
| NFR Design | Yes | SECURITY-02 and SECURITY-08 must be implemented as concrete patterns. |
| Infrastructure Design | Yes | API Gateway, AgentCore target, IAM, and logging configuration are affected. |
| Code Generation | Yes | Backend/CDK implementation and tests are required. |

**Definition of Done**:

- [ ] Existing Hono JWT routes remain protected for browser/extension callers.
- [ ] AgentCore-originated calls can resolve a trustworthy `userId`.
- [ ] IAM role identity alone is not treated as user authorization.
- [ ] Unauthorized or cross-user tool calls fail without leaking tokens or internal paths.
- [ ] Tool-call audit logs exclude tokens and message bodies.
- [ ] CDK tests cover affected Gateway/API/IAM/logging configuration.

---

## U-V3-02: mcp-tool-registry-schema

**Purpose**: Expand and stabilize the MCP tool allowlist, operation schemas, and schema synchronization checks.

**Included Scope**:

- Define the MCP Tool Registry allowlist.
- Expand `pkgs/cdk/schemas/saborou-openapi.yaml` or introduce an equivalent generated/synchronized schema path.
- Include voice-callable task, Slack, Google Calendar/Gmail, proposal, and report tools.
- Exclude OAuth callbacks, webhooks, health, and internal/admin routes.
- Add schema, operationId, description, and allowlist tests.

**Excluded Scope**:

- Implementing new `@Claude` delegation behavior beyond reserving the tool contract.
- Real ElevenLabs Dashboard registration.
- Real AWS integration verification.

**Construction Stages**:

| Stage | Execute? | Rationale |
|-------|----------|-----------|
| Functional Design | Yes | Tool input/output contracts and side-effect classification need detailed design. |
| NFR Requirements | Yes | Input validation and schema drift prevention are security and testability requirements. |
| NFR Design | Yes | Zod/OpenAPI validation and allowlist enforcement patterns are required. |
| Infrastructure Design | Yes | AgentCore schema deployment and CDK outputs/tests are affected. |
| Code Generation | Yes | Schema/test updates are required. |

**Definition of Done**:

- [ ] Every published MCP tool has an operationId and AI-oriented English description.
- [ ] Tool inputs and outputs are validated with OpenAPI/Zod-compatible schemas.
- [ ] Allowlist tests fail if expected tools are missing or excluded routes are published.
- [ ] Schema drift between backend routes and MCP schema is detected by tests or documented generation.
- [ ] Side-effect tools are explicitly marked and require approval metadata.

---

## U-V3-03: slack-claude-delegation

**Purpose**: Add the approved `@Claude` task delegation API/tool while keeping Slack side effects explicit and auditable.

**Included Scope**:

- Add `saborou_delegate_task_to_claude` backend contract.
- Generate a Slack post containing task title, background, expected deliverable, and constraints.
- Require explicit user approval before posting.
- Reuse existing Slack token handling and safe error reporting.
- Add tests for approval gating, message generation, and Slack error handling.

**Excluded Scope**:

- Guaranteeing Claude's execution quality after the Slack mention.
- Adding a new external Claude API integration outside Slack.
- Broad Slack sync behavior unrelated to delegation.

**Construction Stages**:

| Stage | Execute? | Rationale |
|-------|----------|-----------|
| Functional Design | Yes | Delegation text, approval state, and task selection rules are business logic. |
| NFR Requirements | Yes | Slack side effects and secret handling require explicit security requirements. |
| NFR Design | Yes | Approval enforcement, logging, and error masking patterns are required. |
| Infrastructure Design | Conditional | Execute if IAM/env/Secrets permissions or CDK outputs change. |
| Code Generation | Yes | Backend/agent code and tests are required. |

**Definition of Done**:

- [ ] `@Claude` delegation cannot post without explicit approval metadata.
- [ ] The selected task is verified as owned by the authenticated user.
- [ ] The Slack message contains task context and expected output.
- [ ] Slack failures return safe summaries without token or internal details.
- [ ] Unit/integration tests cover success, no-approval, wrong-owner, and Slack failure cases.

---

## U-V3-04: elevenlabs-registration-fallback

**Purpose**: Align the voice integration with ElevenLabs Dashboard remote MCP registration constraints and keep the extension fallback path stable.

**Included Scope**:

- Document and implement configuration for `streamable_http` as the primary ElevenLabs MCP registration type.
- Define `sse` bridge fallback only if real compatibility testing requires it.
- Remove or neutralize assumptions that `/mcp/tools/...` pseudo REST paths are real MCP.
- Keep browser `clientTools` as fallback/UI support, not the primary MCP path.
- Surface MCP endpoint and fallback configuration clearly for demo setup.

**Excluded Scope**:

- Rebuilding the entire ElevenLabs conversational UI.
- Removing the existing direct Hono fallback.
- Implementing both `streamable_http` and `sse` if `streamable_http` passes real verification.

**Construction Stages**:

| Stage | Execute? | Rationale |
|-------|----------|-----------|
| Functional Design | Conditional | Execute for fallback behavior and UI state decisions. |
| NFR Requirements | Yes | Demo availability and auth-token separation are required. |
| NFR Design | Yes | Fallback and safe configuration patterns are required. |
| Infrastructure Design | Conditional | Execute if SSE bridge or new endpoint/CDK output is needed. |
| Code Generation | Yes | Extension/config/docs/tests are required. |

**Definition of Done**:

- [ ] ElevenLabs Dashboard registration uses `streamable_http` first.
- [ ] `sse` bridge is implemented only if compatibility testing blocks `streamable_http`.
- [ ] Browser `clientTools` are documented and tested as fallback/UI support.
- [ ] Direct Hono fallback remains usable for demo resilience.
- [ ] No ElevenLabs or SABOROU secrets are exposed in browser logs or config output.

---

## U-V3-05: real-integration-verification

**Purpose**: Prove the end-to-end demo path with real AWS, AgentCore, ElevenLabs, and Slack, and document troubleshooting steps.

**Included Scope**:

- Build/test instructions across affected packages.
- CDK synth/deploy verification steps.
- AgentCore Gateway/target status verification.
- ElevenLabs Dashboard registration and voice conversation verification.
- Slack reply and `@Claude` delegation verification in a test channel.
- Troubleshooting matrix for AgentCore, Cognito, Slack, Google, and ElevenLabs failures.

**Excluded Scope**:

- New product features not required for demo verification.
- Production monitoring expansion beyond the v3 security/logging needs.

**Construction Stages**:

| Stage | Execute? | Rationale |
|-------|----------|-----------|
| Functional Design | No | This unit verifies integrated behavior rather than adding domain logic. |
| NFR Requirements | Yes | Reliability, observability, and manual E2E evidence are core requirements. |
| NFR Design | Yes | Verification evidence, log review, and fallback patterns need definition. |
| Infrastructure Design | Conditional | Execute if verification requires deployment/output changes. |
| Code Generation | Yes | Scripts, docs, and test fixtures may be required. |

**Definition of Done**:

- [ ] Required tests/typechecks/builds pass for affected packages.
- [ ] CDK synth and AgentCore stack checks pass.
- [ ] AgentCore Gateway target status is verified in AWS.
- [ ] ElevenLabs Agent calls `saborou_get_tasks` through the registered MCP server.
- [ ] Slack reply or `@Claude` delegation succeeds after explicit voice approval.
- [ ] Verification results and troubleshooting steps are documented.

---

## Overall Done Criteria

- [ ] All SECURITY-02 and SECURITY-08 implementation requirements are addressed before Code Generation completion.
- [ ] All v3 user stories map to at least one Unit of Work.
- [ ] No unit depends on a later unit.
- [ ] Existing working browser/extension direct API fallback remains intact.
- [ ] The final Build and Test stage includes real AWS/AgentCore/ElevenLabs/Slack verification.
