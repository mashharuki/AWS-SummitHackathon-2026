import { describe, expect, it, vi } from "vitest";
import {
  auditMcpToolCall,
  buildSafeMcpAuditEvent,
  hashUserId,
} from "../../mcp/audit.js";

describe("MCP audit", () => {
  it("hashes userId and never returns the raw identifier", () => {
    const hash = hashUserId("user-123");

    expect(hash).not.toBe("user-123");
    expect(hash).toHaveLength(16);
  });

  it("builds a safe audit event without forbidden fields", () => {
    const event = buildSafeMcpAuditEvent({
      requestId: "req-1",
      toolName: "saborou_list_tasks",
      source: "agentcore",
      userId: "user-123",
      status: "success",
      durationMs: 12,
    });

    expect(event).toEqual({
      action: "mcp_tool_call",
      requestId: "req-1",
      toolName: "saborou_list_tasks",
      source: "agentcore",
      userIdHash: expect.any(String),
      status: "success",
      durationMs: 12,
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("user-123");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("args");
    expect(serialized).not.toContain("prompt");
    expect(serialized).not.toContain("stack");
  });

  it("emits structured JSON", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    auditMcpToolCall({
      requestId: "req-2",
      toolName: "saborou_list_tasks",
      source: "agentcore",
      userId: "user-123",
      status: "success",
      durationMs: 3,
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"action":"mcp_tool_call"'),
    );
    logSpy.mockRestore();
  });
});
