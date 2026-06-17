import type {
  McpPrecheckResult,
  McpToolContext,
  McpToolDefinition,
  McpToolInvocation,
} from "./types.js";

export const DEFAULT_MCP_TOOL_ALLOWLIST: ReadonlyArray<McpToolDefinition> = [
  { name: "saborou_mcp_health", effect: "read" },
  { name: "saborou_side_effect_probe", effect: "side_effect" },
];

export function precheckMcpInvocation(
  context: McpToolContext | null,
  invocation: McpToolInvocation,
  allowlist: ReadonlyArray<McpToolDefinition> = DEFAULT_MCP_TOOL_ALLOWLIST,
): McpPrecheckResult {
  if (!context?.identity.userId) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Verified user identity is required",
    };
  }

  const tool = allowlist.find((item) => item.name === invocation.toolName);
  if (!tool) {
    return {
      ok: false,
      code: "TOOL_NOT_ALLOWED",
      message: "Tool is not allowed",
    };
  }

  if (!isJsonObject(invocation.args)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Tool arguments must be a JSON object",
    };
  }

  if (tool.effect === "side_effect" && invocation.approved !== true) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Side-effect tool requires explicit approval",
    };
  }

  return { ok: true, tool };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
