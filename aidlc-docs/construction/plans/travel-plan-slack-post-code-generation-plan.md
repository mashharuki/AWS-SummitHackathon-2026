# Travel Plan Slack Post Code Generation Plan

## Unit Context

- Unit name: `travel-plan-slack-post`
- Project type: Brownfield
- Application code target: `pkgs/backend/` and `pkgs/cdk/`
- Documentation target: `aidlc-docs/construction/travel-plan-slack-post/code/`
- Existing dependencies: `TravelPlanningService.plan()`, Slack token lookup and `SlackClient`, MCP registry/precheck/adapter, AgentCore OpenAPI schema

## Traceability

- Implement `POST /api/travel/plan-and-post-to-slack`.
- Add Slack mrkdwn formatting with escaping and bounded length.
- Publish MCP tool `saborou_plan_trip_and_post_to_slack` as an approved side-effect tool.
- Cover route, formatter, MCP, JSON-RPC, REST adapter, and OpenAPI drift behavior with tests.

## Execution Steps

1. [x] Inspect existing travel, Slack, MCP registry, JSON-RPC, OpenAPI, and tests.
2. [x] Add travel Slack post schemas, service logic, and formatter.
3. [x] Add backend route `POST /api/travel/plan-and-post-to-slack`.
4. [x] Wire MCP type, registry, validation schema, REST adapter dispatch, and JSON-RPC schema/caller dispatch.
5. [x] Update AgentCore OpenAPI schema for the new MCP tool path.
6. [x] Add route/service/formatter tests for approval, clarification, token preference, thread replies, Slack errors, and secret-safe markdown.
7. [x] Add MCP tests for registry publication, validation, JSON-RPC forwarding, REST adapter dispatch, and OpenAPI drift.
8. [x] Run backend and CDK verification commands.
9. [x] Write code-generation summary and update AI-DLC state/audit.
