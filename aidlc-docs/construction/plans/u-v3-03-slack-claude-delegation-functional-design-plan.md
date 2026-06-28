# Functional Design Plan - U-V3-03 slack-claude-delegation

## Stage Context
- **Phase**: CONSTRUCTION
- **Unit**: U-V3-03 slack-claude-delegation
- **Stage**: Functional Design
- **Created At**: 2026-06-17T12:41:41Z
- **Status**: Functional Design artifacts generated; awaiting user approval.

## Scope
Define the business logic for posting an approved Slack `@Claude` delegation message for a caller-owned SABOROU task.

## Inputs Reviewed
- [x] U-V3-03 unit definition.
- [x] U-V3-03 dependency map.
- [x] U-V3-03 story map and US-V3-05 acceptance criteria.
- [x] v3 requirements FR-V3-04 and NFR-V3-S1/S2/S3/T1.
- [x] Application Design `SlackDelegationService`.
- [x] Existing Slack route/token handling and task repository ownership lookup.
- [x] U-V3-02 registry summary and reserved `saborou_delegate_to_claude` contract.

## Execution Checklist
- [x] Step 1: Analyze U-V3-03 unit scope, dependencies, and Definition of Done.
- [x] Step 2: Review existing Slack posting, task ownership, and token handling behavior.
- [x] Step 3: Resolve naming drift between `saborou_delegate_task_to_claude` and the U-V3-02 registry contract.
- [x] Step 4: Assess whether clarifying questions are required.
- [x] Step 5: Define domain entities for delegation request, task context, generated message, approval, Slack result, and audit record.
- [x] Step 6: Define business rules for approval gating, task ownership, message content, error handling, and safe output.
- [x] Step 7: Define the business logic model and main success/failure flows.
- [x] Step 8: Generate Functional Design artifacts.
- [x] Step 9: Update `aidlc-docs/aidlc-state.md` and `aidlc-docs/audit.md`.

## Clarifying Questions Assessment
No question file was generated for this stage.

Rationale:
- The Unit Definition requires explicit `channelId`, optional `threadTs`, explicit approval, and user-owned task verification.
- The Application Design already defines `SlackDelegationService` input/output shape.
- Existing Slack route code provides the token retrieval and Slack posting behavior to reuse.
- U-V3-02 already reserved the MCP contract as `saborou_delegate_to_claude`; U-V3-03 will implement that reserved registry entry rather than adding a second tool name.

## Artifacts
- `aidlc-docs/construction/u-v3-03-slack-claude-delegation/functional-design/domain-entities.md`
- `aidlc-docs/construction/u-v3-03-slack-claude-delegation/functional-design/business-rules.md`
- `aidlc-docs/construction/u-v3-03-slack-claude-delegation/functional-design/business-logic-model.md`

## Extension Compliance
| Extension Rule | Status | Rationale |
|---|---|---|
| Security Baseline | Compliant | Functional design enforces approval before Slack posting, object-level task ownership, safe error output, input validation constraints, and no token logging. |
| Property-Based Testing | N/A | Disabled in `aidlc-docs/aidlc-state.md`. |
