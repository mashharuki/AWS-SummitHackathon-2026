export type McpSource = "agentcore" | "extension-fallback";

export type McpAuditStatus =
  | "success"
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "tool_not_allowed"
  | "tool_error";

export type McpToolEffect = "read" | "side_effect";

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
  name: string;
  effect: McpToolEffect;
};

export type McpPrecheckFailureCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "TOOL_NOT_ALLOWED"
  | "VALIDATION_ERROR";

export type McpPrecheckResult =
  | { ok: true; tool: McpToolDefinition }
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
