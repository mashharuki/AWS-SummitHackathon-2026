import { createHash } from "node:crypto";
import type { McpAuditStatus, McpSource, SafeMcpAuditEvent } from "./types.js";

export type WriteAuditEvent = (event: SafeMcpAuditEvent) => void;

export type AuditMcpToolCallInput = {
  requestId: string;
  toolName: string;
  source: McpSource;
  userId?: string;
  status: McpAuditStatus;
  durationMs: number;
};

export function hashUserId(userId: string | undefined): string {
  if (!userId) {
    return "anonymous";
  }

  return createHash("sha256").update(userId).digest("hex").slice(0, 16);
}

export function buildSafeMcpAuditEvent(
  input: AuditMcpToolCallInput,
): SafeMcpAuditEvent {
  return {
    action: "mcp_tool_call",
    requestId: input.requestId,
    toolName: input.toolName,
    source: input.source,
    userIdHash: hashUserId(input.userId),
    status: input.status,
    durationMs: input.durationMs,
  };
}

export function auditMcpToolCall(input: AuditMcpToolCallInput): void {
  console.log(JSON.stringify(buildSafeMcpAuditEvent(input)));
}
