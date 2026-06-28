import { describe, expect, it } from "vitest";
import { precheckMcpInvocation } from "../../mcp/precheck.js";
import type { McpToolContext } from "../../mcp/types.js";

const context: McpToolContext = {
  requestId: "req-1",
  source: "agentcore",
  identity: {
    userId: "user-123",
    issuer: "issuer",
    audience: "audience",
  },
};

describe("precheckMcpInvocation", () => {
  it("rejects missing verified identity", () => {
    const result = precheckMcpInvocation(null, {
      toolName: "saborou_list_tasks",
      args: {},
    });

    expect(result).toEqual({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Verified user identity is required",
    });
  });

  it("rejects unknown tools before dispatch", () => {
    const result = precheckMcpInvocation(context, {
      toolName: "unknown_tool",
      args: {},
    });

    expect(result).toMatchObject({ ok: false, code: "TOOL_NOT_ALLOWED" });
  });

  it("rejects non-object args", () => {
    const result = precheckMcpInvocation(context, {
      toolName: "saborou_list_tasks",
      args: "raw-string",
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  it("rejects schema-invalid object args", () => {
    const result = precheckMcpInvocation(context, {
      toolName: "saborou_get_task",
      args: { taskId: "<script>" },
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  it("rejects side-effect tools without explicit approval", () => {
    const result = precheckMcpInvocation(context, {
      toolName: "saborou_send_slack_reply",
      args: { replyText: "了解しました", channelId: "C12345" },
      approved: false,
    });

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("allows approved side-effect tools", () => {
    const result = precheckMcpInvocation(context, {
      toolName: "saborou_send_slack_reply",
      args: { replyText: "了解しました", channelId: "C12345" },
      approved: true,
    });

    expect(result).toMatchObject({
      ok: true,
      tool: { name: "saborou_send_slack_reply", effect: "side_effect" },
      parsedArgs: { replyText: "了解しました", channelId: "C12345" },
    });
  });
});
