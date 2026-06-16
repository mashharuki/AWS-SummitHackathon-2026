# SABOROU v3 Component Methods

**作成日**: 2026-06-16

---

## C-V3-02: McpToolAdapter

```typescript
type McpToolName =
  | "saborou_get_tasks"
  | "saborou_get_task"
  | "saborou_judge_sabori"
  | "saborou_send_slack_reply"
  | "saborou_schedule_report"
  | "saborou_get_google_calendar_status"
  | "saborou_fetch_google_calendar"
  | "saborou_fetch_gmail_tasks"
  | "saborou_get_slack_channels"
  | "saborou_sync_slack_messages"
  | "saborou_create_task"
  | "saborou_approve_task_candidate"
  | "saborou_delegate_task_to_claude";

interface McpToolContext {
  userId: string;
  requestId: string;
  humanApproved?: boolean;
  source: "agentcore" | "extension-fallback";
}

interface McpToolAdapter {
  invokeTool(
    toolName: McpToolName,
    args: unknown,
    context: McpToolContext,
  ): Promise<unknown>;
}
```

**Purpose**: Normalize tool invocation and keep AgentCore/Hono implementation details out of individual route handlers.

---

## C-V3-03: McpIdentityResolver

```typescript
interface McpIdentityResolver {
  resolveFromAgentCoreRequest(request: unknown): Promise<{
    userId: string;
    subject: string;
    claims: Record<string, unknown>;
  }>;

  assertUserScopedAccess(userId: string, resourceOwnerId: string): void;
}
```

**Purpose**: Close SECURITY-08 by making user identity explicit on the Gateway path.

---

## C-V3-04: McpToolRegistry

```typescript
interface McpToolDefinition {
  name: McpToolName;
  operationId: string;
  sideEffect: "read" | "write" | "external-post";
  requiresHumanApproval: boolean;
  inputSchema: unknown;
  outputSchema: unknown;
}

interface McpToolRegistry {
  listTools(): McpToolDefinition[];
  getTool(name: McpToolName): McpToolDefinition;
  assertAllowed(name: string): asserts name is McpToolName;
}
```

**Purpose**: Provide a single allowlist for OpenAPI generation, tests, and runtime safety checks.

---

## C-V3-05: SlackDelegationService

```typescript
interface DelegateTaskToClaudeInput {
  userId: string;
  taskId: string;
  channelId: string;
  threadTs?: string;
  humanApproved: boolean;
  instructionOverride?: string;
}

interface DelegateTaskToClaudeResult {
  ok: true;
  ts: string;
  taskId: string;
  delegatedText: string;
}

interface SlackDelegationService {
  buildDelegationText(input: {
    taskTitle: string;
    description?: string;
    deadline?: string | null;
    requester?: string;
    instructionOverride?: string;
  }): string;

  delegateTaskToClaude(
    input: DelegateTaskToClaudeInput,
  ): Promise<DelegateTaskToClaudeResult>;
}
```

**Purpose**: Keep `@Claude` delegation explicit, auditable, and approval-gated.

---

## C-V3-06: VoiceToolClient

```typescript
interface VoiceToolClient {
  callTool(toolName: McpToolName, args: unknown, jwt: string): Promise<unknown>;
  callGatewayTool(toolName: McpToolName, args: unknown, jwt: string): Promise<unknown>;
  callHonoFallback(toolName: McpToolName, args: unknown, jwt: string): Promise<unknown>;
}
```

**Purpose**: Replace pseudo-MCP assumptions with an explicit true Gateway path plus direct Hono fallback.

---

## C-V3-07: McpVerificationHarness

```typescript
interface McpVerificationHarness {
  verifyGatewayTargetActive(gatewayIdentifier: string): Promise<void>;
  verifyToolCall(toolName: McpToolName, args: unknown): Promise<void>;
  verifyElevenLabsTaskReadout(): Promise<void>;
  verifySlackDelegation(): Promise<void>;
}
```

**Purpose**: Provide repeatable evidence that the demo path is real, not only unit-tested.
