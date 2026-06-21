export type McpSource = "agentcore" | "extension-fallback";

export type McpAuditStatus =
  | "success"
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "tool_not_allowed"
  | "tool_error";

export type McpToolEffect = "read" | "side_effect";

export type McpToolName =
  | "saborou_list_tasks"
  | "saborou_get_task"
  | "saborou_list_candidates"
  | "saborou_generate_reply_draft"
  | "saborou_judge_sabori"
  | "saborou_fetch_google_calendar"
  | "saborou_fetch_gmail"
  | "saborou_send_slack_reply"
  | "saborou_schedule_report"
  | "saborou_find_task"
  | "saborou_delegate_to_claude"
  | "saborou_plan_trip"
  | "saborou_plan_trip_and_post_to_slack"
  | "saborou_create_marp_slides"
  | "saborou_create_marp_slides_and_post_to_slack";

export type McpHttpMethod = "GET" | "POST";

export type McpToolImplementationStatus =
  | "implemented"
  | "adapter_validated"
  | "reserved";

export type McpToolOutputMode = "safe_summary" | "safe_action_result";

export type McpIdentity = {
  userId: string;
  issuer: string;
  audience: string;
};

export type McpToolContext = {
  requestId: string;
  source: McpSource;
  identity: McpIdentity;
};

export type McpToolInvocation = {
  toolName: string;
  args: unknown;
  approved?: boolean;
};

export type McpToolDefinition = {
  name: McpToolName;
  effect: McpToolEffect;
  description: string;
  http: {
    method: McpHttpMethod;
    path: string;
  };
  schema: {
    input: string;
    output: string;
  };
  approval: {
    required: boolean;
    reason?: string;
  };
  outputMode: McpToolOutputMode;
  implementationStatus: McpToolImplementationStatus;
  published: boolean;
};

export type McpPrecheckFailureCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "TOOL_NOT_ALLOWED"
  | "VALIDATION_ERROR";

export type McpPrecheckResult =
  | {
      ok: true;
      tool: McpToolDefinition;
      parsedArgs: Record<string, unknown>;
    }
  | { ok: false; code: McpPrecheckFailureCode; message: string };

export type SafeMcpAuditEvent = {
  action: "mcp_tool_call";
  requestId: string;
  toolName: string;
  source: McpSource;
  userIdHash: string;
  status: McpAuditStatus;
  durationMs: number;
};

export type SafeMcpErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "TOOL_NOT_ALLOWED"
  | "VALIDATION_ERROR"
  | "TOOL_ERROR";

export type SafeMcpErrorResponse = {
  error: {
    code: SafeMcpErrorCode;
    message: string;
  };
};

export type SafeMcpSuccessResponse = {
  ok: true;
  requestId: string;
  toolName: string;
  result: Record<string, unknown>;
};
