import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { UnauthorizedError } from "../errors.js";
import {
  auditMcpToolCall,
  buildSafeMcpAuditEvent,
  type WriteAuditEvent,
} from "../mcp/audit.js";
import {
  resolveMcpIdentity,
  type McpIdentityResolverOptions,
} from "../mcp/identity.js";
import {
  DEFAULT_MCP_TOOL_ALLOWLIST,
  precheckMcpInvocation,
} from "../mcp/precheck.js";
import type {
  McpAuditStatus,
  McpSource,
  McpToolContext,
  SafeMcpErrorCode,
  SafeMcpErrorResponse,
  SafeMcpSuccessResponse,
} from "../mcp/types.js";

type CreateMcpRouteOptions = McpIdentityResolverOptions & {
  auditWriter?: WriteAuditEvent;
};

type McpRequestBody = {
  args?: unknown;
  approved?: boolean;
};

const SOURCE: McpSource = "agentcore";

export function createMcpRoute(options: CreateMcpRouteOptions = {}) {
  const mcp = new Hono();

  mcp.post("/tools/:toolName", async (c) => {
    const startedAt = Date.now();
    const toolName = c.req.param("toolName");
    const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
    let context: McpToolContext | null = null;
    let status: McpAuditStatus = "tool_error";

    try {
      const identity = await resolveMcpIdentity(
        c.req.header("authorization") ?? null,
        options,
      );
      context = { requestId, source: SOURCE, identity };

      const body = await parseMcpBody(c.req.raw);
      const precheck = precheckMcpInvocation(context, {
        toolName,
        args: body.args ?? {},
        approved: body.approved === true,
      });

      if (!precheck.ok) {
        status = mapPrecheckCodeToAuditStatus(precheck.code);
        return c.json(
          toSafeError(precheck.code, precheck.message),
          mapErrorCodeToStatus(precheck.code),
        );
      }

      const response: SafeMcpSuccessResponse = {
        ok: true,
        requestId,
        toolName,
        result: dispatchPlaceholderTool(precheck.tool.name),
      };
      status = "success";
      return c.json(response);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        status = "unauthorized";
        return c.json(toSafeError("UNAUTHORIZED", error.message), 401);
      }

      status = "tool_error";
      return c.json(toSafeError("TOOL_ERROR", "Tool execution failed"), 500);
    } finally {
      const event = {
        requestId,
        toolName,
        source: SOURCE,
        userId: context?.identity.userId,
        status,
        durationMs: Date.now() - startedAt,
      };
      if (options.auditWriter) {
        options.auditWriter(buildSafeMcpAuditEvent(event));
      } else {
        auditMcpToolCall(event);
      }
    }
  });

  return mcp;
}

async function parseMcpBody(request: Request): Promise<McpRequestBody> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return {};
  }

  const parsed = (await request.json()) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { args: parsed };
  }

  return parsed as McpRequestBody;
}

function dispatchPlaceholderTool(toolName: string): Record<string, unknown> {
  if (toolName === "saborou_side_effect_probe") {
    return { status: "approved" };
  }

  const allowedNames = DEFAULT_MCP_TOOL_ALLOWLIST.map((tool) => tool.name);
  return {
    status: "ok",
    adapter: "mcp-transport-auth-adapter",
    allowlist: allowedNames,
  };
}

function toSafeError(
  code: SafeMcpErrorCode,
  message: string,
): SafeMcpErrorResponse {
  return { error: { code, message } };
}

function mapPrecheckCodeToAuditStatus(code: SafeMcpErrorCode): McpAuditStatus {
  switch (code) {
    case "UNAUTHORIZED":
      return "unauthorized";
    case "FORBIDDEN":
      return "forbidden";
    case "TOOL_NOT_ALLOWED":
      return "tool_not_allowed";
    case "VALIDATION_ERROR":
      return "validation_error";
    case "TOOL_ERROR":
      return "tool_error";
  }
}

function mapErrorCodeToStatus(code: SafeMcpErrorCode): ContentfulStatusCode {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "TOOL_NOT_ALLOWED":
      return 404;
    case "VALIDATION_ERROR":
      return 400;
    case "TOOL_ERROR":
      return 500;
  }
}
