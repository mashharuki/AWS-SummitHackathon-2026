import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError, UnauthorizedError } from "../errors.js";
import type { MarpSlideService } from "../marp/MarpSlideService.js";
import {
  type WriteAuditEvent,
  auditMcpToolCall,
  buildSafeMcpAuditEvent,
} from "../mcp/audit.js";
import {
  type McpIdentityResolverOptions,
  resolveMcpIdentity,
} from "../mcp/identity.js";
import { precheckMcpInvocation } from "../mcp/precheck.js";
import type {
  McpAuditStatus,
  McpSource,
  McpToolContext,
  McpToolDefinition,
  SafeMcpErrorCode,
  SafeMcpErrorResponse,
  SafeMcpSuccessResponse,
} from "../mcp/types.js";
import type { SlackDelegationService } from "../services/SlackDelegationService.js";
import type { TravelPlanningService } from "../travel/TravelPlanningService.js";

type CreateMcpRouteOptions = McpIdentityResolverOptions & {
  auditWriter?: WriteAuditEvent;
  delegationService?: Pick<SlackDelegationService, "delegateToClaude">;
  travelPlanningService?: Pick<TravelPlanningService, "plan">;
  marpSlideService?: Pick<MarpSlideService, "createSlides">;
  caller?: (path: string, init: RequestInit) => Promise<Response>;
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
        result: await dispatchRegistryTool({
          toolName: precheck.tool.name,
          tool: precheck.tool,
          parsedArgs: precheck.parsedArgs,
          context,
          approved: body.approved === true,
          options,
        }),
      };
      status = "success";
      return c.json(response);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        status = "unauthorized";
        return c.json(toSafeError("UNAUTHORIZED", error.message), 401);
      }

      if (error instanceof AppError) {
        const safe = mapAppErrorToMcpError(error);
        status = mapPrecheckCodeToAuditStatus(safe.code);
        return c.json(toSafeError(safe.code, safe.message), safe.statusCode);
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

async function dispatchRegistryTool(input: {
  toolName: string;
  tool: McpToolDefinition;
  parsedArgs: Record<string, unknown>;
  context: McpToolContext;
  approved: boolean;
  options: CreateMcpRouteOptions;
}): Promise<Record<string, unknown>> {
  if (input.toolName === "saborou_delegate_to_claude") {
    if (!input.options.delegationService) {
      throw new AppError(
        500,
        "TOOL_ERROR",
        "Claude delegation is not configured",
      );
    }

    const result = await input.options.delegationService.delegateToClaude({
      userId: input.context.identity.userId,
      taskId: String(input.parsedArgs.taskId),
      channelId: String(input.parsedArgs.channelId),
      ...(typeof input.parsedArgs.threadTs === "string"
        ? { threadTs: input.parsedArgs.threadTs }
        : {}),
      ...(typeof input.parsedArgs.instruction === "string"
        ? { instruction: input.parsedArgs.instruction }
        : {}),
      approved: input.approved,
      requestId: input.context.requestId,
    });

    return {
      status: "delegated",
      taskId: result.taskId,
      channelId: result.channelId,
      ts: result.ts,
      delegatedTextPreview: result.delegatedTextPreview,
    };
  }

  if (input.toolName === "saborou_plan_trip") {
    if (!input.options.travelPlanningService) {
      throw new AppError(
        500,
        "TOOL_ERROR",
        "Travel planning is not configured",
      );
    }

    return input.options.travelPlanningService.plan(
      input.parsedArgs,
    ) as Promise<Record<string, unknown>>;
  }

  if (input.toolName === "saborou_plan_trip_and_post_to_slack") {
    if (!input.options.caller) {
      throw new AppError(
        500,
        "TOOL_ERROR",
        "Travel plan Slack posting is not configured",
      );
    }

    return callInternalApi(input.options.caller, {
      tool: input.tool,
      parsedArgs: { ...input.parsedArgs, approved: input.approved },
      authorization: "",
      userId: input.context.identity.userId,
    });
  }

  if (input.toolName === "saborou_create_marp_slides") {
    if (!input.options.marpSlideService) {
      throw new AppError(
        500,
        "TOOL_ERROR",
        "Marp slide service is not configured",
      );
    }

    return input.options.marpSlideService.createSlides(
      input.parsedArgs,
    ) as Promise<Record<string, unknown>>;
  }

  if (input.toolName === "saborou_create_marp_slides_and_post_to_slack") {
    if (!input.options.caller) {
      throw new AppError(
        500,
        "TOOL_ERROR",
        "Marp slide Slack posting is not configured",
      );
    }

    return callInternalApi(input.options.caller, {
      tool: input.tool,
      parsedArgs: { ...input.parsedArgs, approved: input.approved },
      authorization: "",
      userId: input.context.identity.userId,
    });
  }

  if (
    input.toolName === "saborou_decompose_task" ||
    input.toolName === "saborou_suggest_free_time"
  ) {
    if (!input.options.caller) {
      throw new AppError(500, "TOOL_ERROR", "Task analysis is not configured");
    }

    return callInternalApi(input.options.caller, {
      tool: input.tool,
      parsedArgs: input.parsedArgs,
      authorization: "",
      userId: input.context.identity.userId,
    });
  }

  return {
    status: input.tool.approval.required
      ? "validated_for_approved_action"
      : "validated",
    target: {
      method: input.tool.http.method,
      path: input.tool.http.path,
    },
    outputMode: input.tool.outputMode,
    implementationStatus: input.tool.implementationStatus,
    requiresApproval: input.tool.approval.required,
    validatedArgumentKeys: Object.keys(input.parsedArgs).sort(),
  };
}

async function callInternalApi(
  caller: NonNullable<CreateMcpRouteOptions["caller"]>,
  input: {
    tool: McpToolDefinition;
    parsedArgs: Record<string, unknown>;
    authorization: string;
    userId: string;
  },
): Promise<Record<string, unknown>> {
  let apiPath = input.tool.http.path;
  const usedPathKeys = new Set<string>();
  for (const [key, value] of Object.entries(input.parsedArgs)) {
    const placeholder = `{${key}}`;
    if (apiPath.includes(placeholder)) {
      apiPath = apiPath.replace(placeholder, encodeURIComponent(String(value)));
      usedPathKeys.add(key);
    }
  }
  const remainingArgs = Object.fromEntries(
    Object.entries(input.parsedArgs).filter(([key]) => !usedPathKeys.has(key)),
  );
  let body: string | undefined;
  if (input.tool.http.method === "GET") {
    const qs = new URLSearchParams(
      Object.entries(remainingArgs)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)]),
    );
    if (qs.toString()) apiPath += `?${qs.toString()}`;
  } else {
    body = JSON.stringify(remainingArgs);
  }

  const response = await caller(apiPath, {
    method: input.tool.http.method,
    headers: {
      Authorization: input.authorization,
      "Content-Type": "application/json",
      "x-internal-sub": input.userId,
    },
    body,
  });

  if (!response.ok) {
    throw new AppError(
      response.status as ContentfulStatusCode,
      "TOOL_ERROR",
      "Tool execution failed",
    );
  }

  return response.json() as Promise<Record<string, unknown>>;
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

function mapAppErrorToMcpError(error: AppError): {
  code: SafeMcpErrorCode;
  message: string;
  statusCode: ContentfulStatusCode;
} {
  if (error.statusCode === 403) {
    return { code: "FORBIDDEN", message: error.message, statusCode: 403 };
  }

  if (error.statusCode === 400) {
    return {
      code: "VALIDATION_ERROR",
      message: error.message,
      statusCode: 400,
    };
  }

  return {
    code: "TOOL_ERROR",
    message: "Tool execution failed",
    statusCode: (error.statusCode >= 400 && error.statusCode <= 599
      ? error.statusCode
      : 500) as ContentfulStatusCode,
  };
}
