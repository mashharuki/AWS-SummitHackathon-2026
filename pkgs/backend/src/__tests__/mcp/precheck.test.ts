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
      toolName: "saborou_mcp_health",
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
      toolName: "saborou_mcp_health",
      args: "raw-string",
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  it("rejects side-effect tools without explicit approval", () => {
    const result = precheckMcpInvocation(context, {
      toolName: "saborou_side_effect_probe",
      args: {},
      approved: false,
    });

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("allows approved side-effect tools", () => {
    const result = precheckMcpInvocation(context, {
      toolName: "saborou_side_effect_probe",
      args: {},
      approved: true,
    });

    expect(result).toMatchObject({
      ok: true,
      tool: { name: "saborou_side_effect_probe", effect: "side_effect" },
    });
  });
});
