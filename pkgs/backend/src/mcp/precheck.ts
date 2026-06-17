import type {
  McpPrecheckResult,
  McpToolContext,
  McpToolInvocation,
} from "./types.js";
import { getMcpToolDefinition } from "./registry.js";
import { parseMcpToolArgs } from "./schemas.js";

export function precheckMcpInvocation(
  context: McpToolContext | null,
  invocation: McpToolInvocation,
): McpPrecheckResult {
  if (!context?.identity.userId) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Verified user identity is required",
    };
  }

  const tool = getMcpToolDefinition(invocation.toolName);
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

  if (tool.approval.required && invocation.approved !== true) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Tool requires explicit approval",
    };
  }

  try {
    const parsedArgs = parseMcpToolArgs(tool.name, invocation.args);
    return { ok: true, tool, parsedArgs };
  } catch {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Tool arguments failed schema validation",
    };
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
