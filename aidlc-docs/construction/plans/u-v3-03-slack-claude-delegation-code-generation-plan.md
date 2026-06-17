# Code Generation Plan - U-V3-03 slack-claude-delegation

## Stage Context
- **Phase**: CONSTRUCTION
- **Unit**: U-V3-03 slack-claude-delegation
- **Stage**: Code Generation
- **Part**: Part 1 - Planning
- **Created At**: 2026-06-17T12:53:50Z
- **Status**: Planning complete; awaiting explicit user approval before code generation.

## Single Source Of Truth
This document controls U-V3-03 Code Generation Part 2. Implementation must follow these steps and update checkboxes immediately after each completed step.

## Scope
Implement Slack `@Claude` delegation for the existing U-V3-02 MCP tool contract `saborou_delegate_to_claude`.

U-V3-03 will:
- add a backend delegation service/message builder,
- add a direct authenticated Slack delegation route,
- update MCP schema/registry/dispatch so `saborou_delegate_to_claude` is implemented rather than reserved,
- update OpenAPI schema and drift tests if schema metadata changes,
- add focused backend tests for approval gating, ownership, message generation, safe errors, and MCP dispatch.

## Non-Scope
- No new AWS infrastructure.
- No new persistent idempotency store.
- No external Claude API integration outside Slack.
- No guarantee that Claude completes the delegated work after Slack accepts the post.
- No second MCP tool name such as `saborou_delegate_task_to_claude`.

## Inputs Reviewed
- [x] U-V3-03 Functional Design artifacts.
- [x] U-V3-03 NFR Requirements artifacts.
- [x] U-V3-03 NFR Design artifacts.
- [x] Infrastructure Design skip decision.
- [x] Existing Slack route and route tests.
- [x] Existing MCP route, registry, schemas, and route tests.
- [x] Existing AgentCore OpenAPI schema and drift test approach from U-V3-02.

## Dependencies
- U-V3-01 completed: MCP identity and adapter boundary exists.
- U-V3-02 completed: registry/schema/OpenAPI drift boundary exists.
- Existing Slack token path: `getSlackToken(userId)`.
- Existing Slack client path: `SlackClient.postMessage`.
- Existing task ownership lookup: `DynamoTaskRepository.findById(userId, taskId)`.

## Story Traceability
| Story | Coverage |
|---|---|
| US-V3-05 | Implements approved Slack `@Claude` delegation for a selected task. |
| US-V3-06 | Preserves verified user context and object-level task ownership. |
| US-V3-09 | Provides behavior to verify in the later real integration unit. |

## Application Code Targets

### Backend Service
- `pkgs/backend/src/services/SlackDelegationService.ts`
  - Add deterministic message builder.
  - Add approval-first guard.
  - Add orchestration for task lookup, Slack token retrieval, Slack post, safe result, and safe error mapping.
  - Keep delegated text bounded and safe for response preview.

### Backend Route
- `pkgs/backend/src/routes/slack.ts`
  - Add `POST /api/slack/delegations`.
  - Add Zod validation for `taskId`, `channelId`, optional `threadTs`, optional `instruction`, and `approved`.
  - Reuse `SlackDelegationService`.
  - Preserve existing `/api/slack/reply`, `/notify-task`, `/sync-messages`, and `/channels` behavior.

### MCP Registry And Schemas
- `pkgs/backend/src/mcp/schemas.ts`
  - Add `channelId` and optional `threadTs` to `saborou_delegate_to_claude` args.
  - Keep `instruction` bounded and approval handled by MCP request body.

- `pkgs/backend/src/mcp/registry.ts`
  - Change `saborou_delegate_to_claude` from `reserved` to implemented status only after dispatch is implemented.
  - Keep `effect: "side_effect"` and approval required.

- `pkgs/backend/src/routes/mcp.ts`
  - Replace reserved response for `saborou_delegate_to_claude` with service-backed delegation dispatch.
  - Preserve safe error mapping and safe audit behavior.
  - Keep other registry tools on existing validated adapter behavior.

### AgentCore OpenAPI
- `pkgs/cdk/schemas/saborou-openapi.yaml`
  - Add `channelId` and optional `threadTs` fields to `McpDelegateToClaudeRequest`.
  - Remove reserved wording/extension if implementation status changes.
  - Keep `operationId: saborou_delegate_to_claude`.

### Tests
- `pkgs/backend/src/__tests__/services/SlackDelegationService.test.ts`
  - Message builder required sections and bounds.
  - Approval missing rejects before token/client calls.
  - Missing/wrong-owner task rejects before Slack post.
  - Slack API failure maps to safe error.
  - Success posts expected `@Claude` text and returns safe result.

- `pkgs/backend/src/__tests__/routes/slack.test.ts`
  - Add route tests for `/api/slack/delegations`.
  - Verify validation, approval, success, and Slack failure behavior.

- `pkgs/backend/src/__tests__/mcp/schemas.test.ts`
  - Update `saborou_delegate_to_claude` accepted/rejected args.

- `pkgs/backend/src/__tests__/mcp/registry.test.ts`
  - Update expectation from reserved to implemented after dispatch is ready.

- `pkgs/backend/src/__tests__/routes/mcp.test.ts`
  - Replace reserved-status test with implemented delegation behavior.
  - Verify missing approval remains rejected before dispatch.

- `pkgs/cdk/test/agentcore-schema.test.ts`
  - Existing drift tests should continue to pass; update only if OpenAPI metadata checks need implementation-status awareness.

## Verification Commands
```bash
pnpm --filter backend test
pnpm --filter backend typecheck
pnpm --filter cdk test
pnpm --filter cdk build
```

## Part 1 - Planning Checklist
- [x] Confirm U-V3-03 NFR Design approval from latest user request.
- [x] Decide Infrastructure Design skip/no-new-infrastructure path.
- [x] Inspect existing Slack route, MCP route, registry, schemas, and tests.
- [x] Define exact backend, MCP, OpenAPI, test, and documentation targets.
- [x] Create this Code Generation plan.
- [x] Update `aidlc-docs/audit.md` and `aidlc-docs/aidlc-state.md`.
- [ ] Receive explicit user approval to start Part 2.

## Part 2 - Generation Checklist
- [ ] Create `SlackDelegationService` with approval guard, message builder, task lookup, Slack post, and safe result/error behavior.
- [ ] Add direct `POST /api/slack/delegations` route and request schema.
- [ ] Update MCP `saborou_delegate_to_claude` schema to include `channelId` and optional `threadTs`.
- [ ] Update registry implementation status and metadata for `saborou_delegate_to_claude`.
- [ ] Update MCP route dispatch so `saborou_delegate_to_claude` executes the delegation service instead of returning reserved status.
- [ ] Update AgentCore OpenAPI schema for delegation args and implemented status.
- [ ] Add service-level delegation tests.
- [ ] Add Slack route delegation tests.
- [ ] Update MCP schema, registry, and route tests.
- [ ] Update/verify CDK schema drift tests.
- [ ] Run backend verification: `pnpm --filter backend test`.
- [ ] Run backend type verification: `pnpm --filter backend typecheck`.
- [ ] Run CDK verification: `pnpm --filter cdk test`.
- [ ] Run CDK build: `pnpm --filter cdk build`.
- [ ] Run targeted security checks for no token/full-message leakage, approval-first behavior, no duplicate tool name, and no new infrastructure markers.
- [ ] Generate U-V3-03 code generation summary.
- [ ] Update this plan's checkboxes immediately as each step completes.
- [ ] Update `aidlc-docs/aidlc-state.md` and `aidlc-docs/audit.md`.

## Risk Controls
- Approval-first guard prevents Slack token lookup and posting without explicit approval.
- Object-level authorization uses `findById(userId, taskId)`.
- Deterministic message builder avoids LLM latency and prompt leakage.
- Safe Slack error mapper prevents token/internal leakage.
- Registry/OpenAPI drift tests prevent contract divergence.
- Infrastructure skip decision must be reopened if Code Generation discovers new IAM/env/secret/persistence needs.

## Extension Compliance
| Extension Rule | Status | Rationale |
|---|---|---|
| Security Baseline | Compliant | Plan preserves authentication, task ownership, explicit approval, schema validation, safe token handling, safe logging, and error hardening. |
| Property-Based Testing | N/A | Disabled in `aidlc-docs/aidlc-state.md`. |

## Approval Gate
Code Generation Part 1 is complete. Part 2 will modify application code, tests, OpenAPI schema, and documentation only after explicit user approval.
