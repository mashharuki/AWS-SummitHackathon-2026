# U-V3-03 Tech Stack Decisions: slack-claude-delegation

## Decision Summary
U-V3-03 should use the existing backend stack and avoid introducing new infrastructure or external APIs beyond Slack `chat.postMessage`.

## Decision 1: Backend Runtime
Use existing Hono backend route/service code in `pkgs/backend`.

Rationale:
- Existing Slack routes already authenticate users and post Slack messages.
- The feature is a backend side-effect operation, not a frontend or infrastructure-only change.
- Reuse keeps the browser/extension fallback intact.

## Decision 2: Validation Library
Use Zod for request validation.

Rationale:
- Backend routes already use `zValidator` and Zod.
- U-V3-02 MCP schemas already use Zod.
- Zod satisfies SECURITY-05 for type, length, enum, and format validation.

## Decision 3: Slack Integration
Reuse `getSlackToken(userId)` and `SlackClient` from `@saboru/agent`.

Rationale:
- Existing Slack reply and notify flows already use this path.
- It avoids a second token handling path.
- It keeps secret management inside existing tested boundaries.

## Decision 4: Service Boundary
Implement delegation orchestration as an isolated backend service/helper rather than placing all logic inline in the route.

Recommended modules for Code Generation:
- `pkgs/backend/src/services/SlackDelegationService.ts`
- route integration in `pkgs/backend/src/routes/slack.ts`
- MCP dispatch integration in `pkgs/backend/src/routes/mcp.ts` or a dedicated dispatch module if introduced in Code Generation

Rationale:
- Message building is business logic and should be directly unit-testable.
- Route handlers should remain thin and focused on HTTP concerns.
- MCP and direct Hono route paths can share the same business behavior.

## Decision 5: Message Generation
Use deterministic template-based message generation, not Bedrock/LLM generation, in U-V3-03.

Rationale:
- Functional Design requires task title, background, expected deliverable, and constraints.
- Deterministic formatting is faster, easier to test, and avoids prompt/token leakage.
- It keeps latency and external dependencies low for a Slack side-effect path.

## Decision 6: Idempotency
Do not add persistent idempotency storage in U-V3-03 NFR Requirements.

Rationale:
- The unit's Definition of Done focuses on approval, ownership, message generation, Slack posting, and safe errors.
- Adding persistence would require extra data model and possibly infrastructure decisions.
- Duplicate post handling should be revisited only if retry behavior is introduced.

Constraint:
- Code Generation must document retry/duplicate behavior.

## Decision 7: Infrastructure
Default assumption: no new AWS infrastructure is required.

Rationale:
- Existing Lambda/Hono backend, DynamoDB task repository, Secrets Manager token storage, and Slack client path are reused.
- No new queue, table, secret, or IAM permission is known from NFR Requirements.

Infrastructure Design remains conditional. It should execute only if NFR Design or Code Generation identifies CDK/env/IAM changes.

## Decision 8: Testing
Use Vitest for backend unit/route tests and existing Jest CDK drift tests where schema metadata changes.

Required commands during Code Generation:
- `pnpm --filter backend test`
- `pnpm --filter backend typecheck`
- `pnpm --filter cdk test` if registry/OpenAPI/CDK schema changes
- `pnpm --filter cdk build` if CDK package files change

## Decision 9: MCP Contract
Implement the reserved U-V3-02 tool `saborou_delegate_to_claude`.

Rationale:
- U-V3-02 already published and drift-tested this name.
- Adding `saborou_delegate_task_to_claude` would create duplicate public semantics and schema drift.

Expected Code Generation changes:
- Keep approval metadata required.
- Change implementation status from reserved to implemented when dispatch is ready.
- Update tests that currently expect reserved status.

## Decision 10: Documentation
Record residual risks in the Code Generation summary.

Required residual-risk notes:
- SABOROU only confirms Slack post success, not Claude task completion.
- U-V3-03 has best-effort idempotency unless persistence is explicitly added.
- Real Slack workspace and Claude-in-Slack behavior remains for U-V3-05 verification.
