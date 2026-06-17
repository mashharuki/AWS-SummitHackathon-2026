import type { McpToolDefinition, McpToolName } from "./types.js";

export const EXCLUDED_MCP_ROUTE_PATTERNS = [
  "/api/auth/*",
  "/api/webhooks/*",
  "/api/docs",
  "/api/openapi.json",
  "/api/health",
  "/api/mcp/*",
  "/api/internal/*",
] as const;

export const MCP_TOOL_REGISTRY = [
  {
    name: "saborou_list_tasks",
    effect: "read",
    description: "List the caller's SABOROU tasks with optional status filter.",
    http: { method: "GET", path: "/api/tasks" },
    schema: { input: "saborou_list_tasks", output: "safe_summary" },
    approval: { required: false },
    outputMode: "safe_summary",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_get_task",
    effect: "read",
    description: "Get one caller-owned SABOROU task by task id.",
    http: { method: "GET", path: "/api/tasks/{taskId}" },
    schema: { input: "saborou_get_task", output: "safe_summary" },
    approval: { required: false },
    outputMode: "safe_summary",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_list_candidates",
    effect: "read",
    description: "List pending Slack-derived task candidates for the caller.",
    http: { method: "GET", path: "/api/tasks/candidates" },
    schema: { input: "saborou_list_candidates", output: "safe_summary" },
    approval: { required: false },
    outputMode: "safe_summary",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_generate_reply_draft",
    effect: "read",
    description: "Generate a safe Slack reply draft for a caller-owned task.",
    http: { method: "POST", path: "/api/tasks/{taskId}/proposal" },
    schema: { input: "saborou_generate_reply_draft", output: "safe_summary" },
    approval: { required: false },
    outputMode: "safe_summary",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_judge_sabori",
    effect: "read",
    description: "Judge an incoming Slack message and generate a reply draft.",
    http: { method: "POST", path: "/api/proposals/judge" },
    schema: { input: "saborou_judge_sabori", output: "safe_summary" },
    approval: { required: false },
    outputMode: "safe_summary",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_fetch_google_calendar",
    effect: "side_effect",
    description: "Import Google Calendar workload context into SABOROU.",
    http: { method: "POST", path: "/api/google/calendar/fetch" },
    schema: {
      input: "saborou_fetch_google_calendar",
      output: "safe_action_result",
    },
    approval: {
      required: true,
      reason: "Imports external calendar context into SABOROU.",
    },
    outputMode: "safe_action_result",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_fetch_gmail",
    effect: "side_effect",
    description: "Import Gmail-derived task candidates into SABOROU.",
    http: { method: "POST", path: "/api/google/gmail/fetch" },
    schema: { input: "saborou_fetch_gmail", output: "safe_action_result" },
    approval: {
      required: true,
      reason: "Imports external Gmail context into SABOROU.",
    },
    outputMode: "safe_action_result",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_send_slack_reply",
    effect: "side_effect",
    description:
      "Send an explicitly approved Slack reply on the caller's behalf.",
    http: { method: "POST", path: "/api/slack/reply" },
    schema: { input: "saborou_send_slack_reply", output: "safe_action_result" },
    approval: {
      required: true,
      reason: "Posts a Slack message externally and cannot be silently undone.",
    },
    outputMode: "safe_action_result",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_schedule_report",
    effect: "side_effect",
    description:
      "Generate or schedule a progress report draft for a caller-owned task.",
    http: { method: "POST", path: "/api/tasks/{taskId}/report" },
    schema: { input: "saborou_schedule_report", output: "safe_action_result" },
    approval: {
      required: true,
      reason: "Creates a progress report action for a task.",
    },
    outputMode: "safe_action_result",
    implementationStatus: "adapter_validated",
    published: true,
  },
  {
    name: "saborou_delegate_to_claude",
    effect: "side_effect",
    description: "Delegate an approved SABOROU task to Slack's Claude participant.",
    http: { method: "POST", path: "/api/slack/delegations" },
    schema: {
      input: "saborou_delegate_to_claude",
      output: "safe_action_result",
    },
    approval: {
      required: true,
      reason: "Delegates task execution to an external assistant.",
    },
    outputMode: "safe_action_result",
    implementationStatus: "implemented",
    published: true,
  },
] as const satisfies ReadonlyArray<McpToolDefinition>;

export const MCP_TOOL_NAMES = MCP_TOOL_REGISTRY.map((tool) => tool.name);

export const MCP_TOOL_MAP = new Map<McpToolName, McpToolDefinition>(
  MCP_TOOL_REGISTRY.map((tool) => [tool.name, tool]),
);

export function isMcpToolName(value: string): value is McpToolName {
  return MCP_TOOL_MAP.has(value as McpToolName);
}

export function getMcpToolDefinition(
  name: string,
): McpToolDefinition | undefined {
  return isMcpToolName(name) ? MCP_TOOL_MAP.get(name) : undefined;
}

export function getPublishedMcpTools(): ReadonlyArray<McpToolDefinition> {
  return MCP_TOOL_REGISTRY.filter((tool) => tool.published);
}
