import { Hono } from "hono";
import { getMcpToolDefinition, getPublishedMcpTools } from "../mcp/registry.js";
import {
  resolveMcpIdentity,
  type McpIdentityResolverOptions,
} from "../mcp/identity.js";
import type { McpToolDefinition } from "../mcp/types.js";
import type { SlackDelegationService } from "../services/SlackDelegationService.js";

const PROTOCOL_VERSION = "2024-11-05";

type JsonRpcId = number | string | null;
interface JsonRpcRequest {
  jsonrpc: string;
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

type InternalCaller = (path: string, init: RequestInit) => Promise<Response>;

export type McpJsonRpcRouteOptions = McpIdentityResolverOptions & {
  caller: InternalCaller;
  delegationService?: Pick<SlackDelegationService, "delegateToClaude">;
};

export function createMcpJsonRpcRoute(options: McpJsonRpcRouteOptions) {
  const mcp = new Hono();

  mcp.post("/", async (c) => {
    let body: JsonRpcRequest;
    try {
      body = (await c.req.json()) as JsonRpcRequest;
    } catch {
      return c.json(rpcError(null, -32700, "Parse error"), 400);
    }

    if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
      return c.json(rpcError(body.id ?? null, -32600, "Invalid Request"), 400);
    }

    const id = body.id ?? null;
    const authHeader = c.req.header("authorization") ?? null;

    // Notification (no id) — just acknowledge
    if (body.id === undefined && body.method === "notifications/initialized") {
      return c.body(null, 204);
    }

    switch (body.method) {
      case "initialize":
        return c.json(
          rpcResult(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "SABOROU", version: "3.0.0" },
          }),
        );

      case "tools/list": {
        try {
          await resolveMcpIdentity(authHeader, options);
        } catch {
          return c.json(
            rpcError(id, -32001, "Unauthorized: Bearer token required"),
            401,
          );
        }
        const tools = getPublishedMcpTools().map(toMcpSchema);
        return c.json(rpcResult(id, { tools }));
      }

      case "tools/call": {
        const params = body.params as
          | { name?: string; arguments?: Record<string, unknown> }
          | undefined;
        if (!params?.name) {
          return c.json(
            rpcError(id, -32602, "Invalid params: name is required"),
            400,
          );
        }

        let identity;
        try {
          identity = await resolveMcpIdentity(authHeader, options);
        } catch {
          return c.json(
            rpcError(id, -32001, "Unauthorized: Bearer token required"),
            401,
          );
        }

        try {
          const result = await invokeTool(
            params.name,
            params.arguments ?? {},
            authHeader!,
            identity,
            options,
          );
          return c.json(
            rpcResult(id, {
              content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
              ],
            }),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return c.json(
            rpcError(id, -32603, `Tool execution failed: ${msg}`),
            500,
          );
        }
      }

      default:
        return c.json(
          rpcError(id, -32601, `Method not found: ${body.method}`),
          404,
        );
    }
  });

  return mcp;
}

// ---- JSON-RPC helpers ----

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

// ---- MCP tool schema ----

function toMcpSchema(tool: McpToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: jsonSchemaFor(tool.name),
  };
}

function jsonSchemaFor(toolName: string): Record<string, unknown> {
  switch (toolName) {
    case "saborou_list_tasks":
      return {
        type: "object",
        properties: {
          status: { type: "string", enum: ["active", "completed", "pending"] },
        },
      };
    case "saborou_get_task":
      return {
        type: "object",
        properties: { taskId: { type: "string" } },
        required: ["taskId"],
      };
    case "saborou_list_candidates":
      return { type: "object", properties: {} };
    case "saborou_generate_reply_draft":
      return {
        type: "object",
        properties: {
          taskId: { type: "string" },
          mode: {
            type: "string",
            enum: ["sabori_judgment", "reply_draft", "decline_draft"],
          },
        },
        required: ["taskId"],
      };
    case "saborou_judge_sabori":
      return {
        type: "object",
        properties: {
          message: { type: "string", minLength: 1, maxLength: 4000 },
          senderName: { type: "string", maxLength: 120 },
        },
        required: ["message"],
      };
    case "saborou_fetch_google_calendar":
      return { type: "object", properties: {} };
    case "saborou_fetch_gmail":
      return {
        type: "object",
        properties: {
          maxResults: { type: "integer", minimum: 1, maximum: 20 },
        },
      };
    case "saborou_send_slack_reply":
      return {
        type: "object",
        properties: {
          taskId: { type: "string" },
          replyText: { type: "string", minLength: 1, maxLength: 2000 },
          channelId: { type: "string" },
          threadTs: { type: "string" },
        },
        required: ["replyText", "channelId"],
      };
    case "saborou_schedule_report":
      return {
        type: "object",
        properties: {
          taskId: { type: "string" },
          tone: { type: "string", enum: ["formal", "polite", "casual"] },
        },
        required: ["taskId"],
      };
    case "saborou_delegate_to_claude":
      return {
        type: "object",
        properties: {
          taskId: { type: "string" },
          channelId: { type: "string" },
          threadTs: { type: "string" },
          instruction: { type: "string", minLength: 1, maxLength: 2000 },
        },
        required: ["taskId", "channelId", "instruction"],
      };
    default:
      return { type: "object" };
  }
}

// ---- Tool invocation ----

async function invokeTool(
  toolName: string,
  args: Record<string, unknown>,
  authorization: string,
  identity: { userId: string },
  options: McpJsonRpcRouteOptions,
): Promise<unknown> {
  const tool = getMcpToolDefinition(toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // saborou_delegate_to_claude: call the delegation service directly
  if (toolName === "saborou_delegate_to_claude" && options.delegationService) {
    return options.delegationService.delegateToClaude({
      userId: identity.userId,
      taskId: String(args.taskId),
      channelId: String(args.channelId),
      ...(typeof args.threadTs === "string" ? { threadTs: args.threadTs } : {}),
      ...(typeof args.instruction === "string"
        ? { instruction: args.instruction }
        : {}),
      approved: true,
      requestId: crypto.randomUUID(),
    });
  }

  // All other tools: call the Hono app internally via the injected caller
  let apiPath = tool.http.path;
  const usedPathKeys = new Set<string>();

  // Substitute path params ({taskId} etc.)
  for (const [key, val] of Object.entries(args)) {
    const placeholder = `{${key}}`;
    if (apiPath.includes(placeholder)) {
      apiPath = apiPath.replace(placeholder, encodeURIComponent(String(val)));
      usedPathKeys.add(key);
    }
  }

  const remainingArgs = Object.fromEntries(
    Object.entries(args).filter(([k]) => !usedPathKeys.has(k)),
  );

  const headers: Record<string, string> = {
    Authorization: authorization,
    "Content-Type": "application/json",
    // authMiddleware fallback: inject verified userId for internal Lambda calls
    "x-internal-sub": identity.userId,
  };

  let finalPath = apiPath;
  let body: string | undefined;

  if (tool.http.method === "GET") {
    const qs = new URLSearchParams(
      Object.entries(remainingArgs)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)]),
    );
    if (qs.toString()) finalPath += `?${qs.toString()}`;
  } else {
    body = JSON.stringify(remainingArgs);
  }

  const response = await options.caller(finalPath, {
    method: tool.http.method,
    headers,
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API ${response.status}: ${errText}`);
  }

  return response.json() as Promise<unknown>;
}
